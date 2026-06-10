import { db } from '@/lib/db';
import { evaluateResourceFreshness } from '../freshness-lifecycle';
import type {
  ResourceReverificationResolutionAction,
  ResourceReverificationStatus,
} from '@prisma/client';

export type ReverificationPriorityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

function clampScore(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function scoreRisk(resourceType: string): number {
  if (
    resourceType === 'CONSULAR_SERVICE' ||
    resourceType === 'VISA_SERVICE' ||
    resourceType === 'CITY_REGISTRATION'
  ) {
    return 90;
  }
  if (resourceType === 'GOVERNMENT_INFO' || resourceType === 'TAX_FINANCE') return 75;
  return 55;
}

function scoreTraffic(savedCount: number): number {
  if (savedCount >= 50) return 90;
  if (savedCount >= 20) return 75;
  if (savedCount >= 5) return 55;
  if (savedCount > 0) return 40;
  return 20;
}

function scoreCriticality(resource: { isEssential: boolean; lifecycleStage: string[] }): number {
  if (resource.isEssential) return 90;
  if (
    resource.lifecycleStage.includes('PRE_ARRIVAL') ||
    resource.lifecycleStage.includes('FIRST_30_DAYS')
  ) {
    return 75;
  }
  return 45;
}

function scoreStaleness(ttlDueAt: Date | null, now: Date): number {
  if (!ttlDueAt) return 65;
  const staleDays = Math.max(0, daysBetween(now, ttlDueAt));
  if (staleDays >= 90) return 95;
  if (staleDays >= 45) return 80;
  if (staleDays >= 14) return 65;
  return 50;
}

function computePriorityScore(input: {
  riskScore: number;
  trafficScore: number;
  stalenessScore: number;
  criticalityScore: number;
}) {
  return clampScore(
    input.riskScore * 0.4 +
      input.trafficScore * 0.2 +
      input.stalenessScore * 0.25 +
      input.criticalityScore * 0.15,
  );
}

export function priorityBandForScore(score: number): ReverificationPriorityBand {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function defaultSlaDueAt(score: number, now: Date): Date {
  const band = priorityBandForScore(score);
  const dueInDays = band === 'CRITICAL' ? 2 : band === 'HIGH' ? 4 : band === 'MEDIUM' ? 7 : 14;
  return new Date(now.getTime() + dueInDays * 24 * 60 * 60 * 1000);
}

export async function ingestReverificationQueue(now = new Date()) {
  const resources = await db.resource.findMany({
    where: { isHidden: false },
    select: {
      id: true,
      title: true,
      resourceType: true,
      metadata: true,
      isEssential: true,
      lifecycleStage: true,
      reviewCadenceDays: true,
      lastReviewedAt: true,
      hiddenReason: true,
      isHidden: true,
      _count: { select: { savedBy: true } },
    },
  });

  let upserted = 0;
  let reopened = 0;
  let skipped = 0;

  for (const resource of resources) {
    const freshness = evaluateResourceFreshness({
      isHidden: resource.isHidden,
      hiddenReason: resource.hiddenReason,
      lastReviewedAt: resource.lastReviewedAt,
      reviewCadenceDays: resource.reviewCadenceDays,
      isEssential: resource.isEssential,
      lifecycleStage: resource.lifecycleStage,
      metadata: resource.metadata,
      now,
    });

    if (freshness.state === 'IN_TTL') {
      skipped++;
      continue;
    }

    const riskScore = scoreRisk(resource.resourceType);
    const trafficScore = scoreTraffic(resource._count.savedBy);
    const stalenessScore = scoreStaleness(freshness.ttlDueAt, now);
    const criticalityScore = scoreCriticality(resource);
    const priorityScore = computePriorityScore({
      riskScore,
      trafficScore,
      stalenessScore,
      criticalityScore,
    });

    const existing = await db.resourceReverificationQueue.findUnique({
      where: { resourceId: resource.id },
      select: { id: true, status: true, slaDueAt: true },
    });

    if (existing?.status === 'RESOLVED' || existing?.status === 'DISMISSED') reopened++;

    await db.resourceReverificationQueue.upsert({
      where: { resourceId: resource.id },
      create: {
        resourceId: resource.id,
        status: 'OPEN',
        stateBucket: freshness.state,
        priorityScore,
        riskScore,
        trafficScore,
        stalenessScore,
        criticalityScore,
        slaDueAt: defaultSlaDueAt(priorityScore, now),
        firstQueuedAt: now,
        lastStateChangedAt: now,
      },
      update: {
        status: existing?.status === 'ASSIGNED' ? 'ASSIGNED' : 'OPEN',
        stateBucket: freshness.state,
        priorityScore,
        riskScore,
        trafficScore,
        stalenessScore,
        criticalityScore,
        slaDueAt: existing?.slaDueAt ?? defaultSlaDueAt(priorityScore, now),
        resolutionAction: null,
        resolutionNotes: null,
        lastStateChangedAt: now,
      },
    });
    upserted++;
  }

  return { scanned: resources.length, upserted, reopened, skipped };
}

export async function assignReverificationItem(params: {
  id: string;
  ownerUserId: string;
  reviewerId: string;
}) {
  const now = new Date();
  const item = await db.resourceReverificationQueue.update({
    where: { id: params.id },
    data: {
      ownerUserId: params.ownerUserId,
      status: 'ASSIGNED',
      lastStateChangedAt: now,
    },
    select: { id: true, resourceId: true },
  });

  await db.contentLog.create({
    data: {
      entityType: 'resource',
      entityId: item.resourceId,
      action: 'UPDATED',
      changedBy: params.reviewerId,
      metadata: {
        via: 'resource_reverification_assignment',
        queueItemId: item.id,
        ownerUserId: params.ownerUserId,
      },
    },
  });
}

export async function setReverificationSla(params: {
  id: string;
  slaDueAt: Date;
  reviewerId: string;
}) {
  const now = new Date();
  const item = await db.resourceReverificationQueue.update({
    where: { id: params.id },
    data: {
      slaDueAt: params.slaDueAt,
      lastStateChangedAt: now,
    },
    select: { id: true, resourceId: true },
  });

  await db.contentLog.create({
    data: {
      entityType: 'resource',
      entityId: item.resourceId,
      action: 'UPDATED',
      changedBy: params.reviewerId,
      metadata: {
        via: 'resource_reverification_sla_update',
        queueItemId: item.id,
        slaDueAt: params.slaDueAt.toISOString(),
      },
    },
  });
}

export async function resolveReverificationItem(params: {
  id: string;
  action: ResourceReverificationResolutionAction;
  notes: string;
  reviewerId: string;
}) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const item = await tx.resourceReverificationQueue.findUnique({
      where: { id: params.id },
      select: { id: true, resourceId: true, status: true },
    });
    if (!item) throw new Error('Queue item not found');
    if (item.status === 'RESOLVED' || item.status === 'DISMISSED') return item;

    const queueStatus: ResourceReverificationStatus =
      params.action === 'DISMISSED' ? 'DISMISSED' : 'RESOLVED';

    if (params.action === 'HIDDEN' || params.action === 'ARCHIVED') {
      await tx.resource.update({
        where: { id: item.resourceId },
        data: {
          isHidden: true,
          hiddenReason:
            params.action === 'ARCHIVED'
              ? 'Archived via reverification queue'
              : 'Hidden via reverification queue',
          metadata: {
            reverification: {
              action: params.action,
              resolvedAt: now.toISOString(),
              notes: params.notes,
            },
          },
        },
      });
    } else {
      await tx.resource.update({
        where: { id: item.resourceId },
        data: {
          lastReviewedAt: now,
          metadata: {
            reverification: {
              action: params.action,
              resolvedAt: now.toISOString(),
              notes: params.notes,
            },
          },
        },
      });
    }

    await tx.resourceReverificationQueue.update({
      where: { id: item.id },
      data: {
        status: queueStatus,
        resolutionAction: params.action,
        resolutionNotes: params.notes,
        lastStateChangedAt: now,
      },
    });

    await tx.contentLog.create({
      data: {
        entityType: 'resource',
        entityId: item.resourceId,
        action: 'UPDATED',
        changedBy: params.reviewerId,
        metadata: {
          via: 'resource_reverification_resolution',
          queueItemId: item.id,
          resolutionAction: params.action,
          notes: params.notes,
        },
      },
    });

    return item;
  });
}
