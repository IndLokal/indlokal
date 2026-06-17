import { db } from '@/lib/db';
import { getResourcesForCity } from '@/modules/resources';
import { invalidateResolver } from '@/modules/resources/resolver';
import { computeCityCoverage, type CoverageCell, type CoverageRow } from './coverage';
import { MIN_BLOCKS_PER_STAGE, REQUIRED_STAGES } from './density';
import type { JourneyGapBacklogStatus, ResourceStage } from '@prisma/client';

type PriorityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const OPEN_STATUSES: JourneyGapBacklogStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'];

function clamp(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function stageCriticalityScore(stage: ResourceStage): number {
  if (stage === 'PRE_ARRIVAL') return 95;
  if (stage === 'FIRST_30_DAYS') return 90;
  if (stage === 'FIRST_90_DAYS') return 70;
  if (stage === 'SETTLED') return 55;
  return 40;
}

function severityScore(cell: CoverageCell): number {
  const requiredMissing = REQUIRED_STAGES.includes(cell.stage) && cell.total === 0;
  if (requiredMissing) return 95;
  const deficit = Math.max(0, MIN_BLOCKS_PER_STAGE - cell.total);
  if (deficit <= 0) return 0;
  return clamp(50 + deficit * 20);
}

function trafficScore(signalCount: number): number {
  if (signalCount >= 50) return 95;
  if (signalCount >= 25) return 80;
  if (signalCount >= 10) return 65;
  if (signalCount > 0) return 50;
  return 35;
}

function trustGapScore(needsVerificationCount: number, total: number): number {
  if (total <= 0) return 80;
  const ratio = needsVerificationCount / total;
  return clamp(ratio * 100);
}

function priorityScore(input: {
  trafficScore: number;
  severityScore: number;
  stageCriticalityScore: number;
  trustGapScore: number;
}): number {
  return clamp(
    input.trafficScore * 0.3 +
      input.severityScore * 0.35 +
      input.stageCriticalityScore * 0.2 +
      input.trustGapScore * 0.15,
  );
}

export function priorityBandForJourneyGap(score: number): PriorityBand {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function defaultSlaDueAt(score: number, now: Date): Date {
  const band = priorityBandForJourneyGap(score);
  const dueDays = band === 'CRITICAL' ? 3 : band === 'HIGH' ? 7 : band === 'MEDIUM' ? 14 : 21;
  return addDays(now, dueDays);
}

function gapSummary(personaLabel: string, cell: CoverageCell): string {
  const requiredMissing = REQUIRED_STAGES.includes(cell.stage) && cell.total === 0;
  const deficit = Math.max(0, MIN_BLOCKS_PER_STAGE - cell.total);
  if (requiredMissing) {
    return `${personaLabel} / ${cell.label}: required stage is missing.`;
  }
  return `${personaLabel} / ${cell.label}: ${cell.total} blocks available (deficit ${deficit}).`;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function loadPersonaTrafficSignals(now: Date): Promise<Map<string, number>> {
  const since = addDays(now, -30);
  const rows = await db.userInteraction.findMany({
    where: {
      entityType: 'RESOURCE',
      interactionType: 'CLICK_ACCESS',
      createdAt: { gte: since },
      cityId: { not: null },
    },
    select: { cityId: true, metadata: true },
  });

  const signals = new Map<string, number>();

  for (const row of rows) {
    if (
      !row.cityId ||
      !row.metadata ||
      typeof row.metadata !== 'object' ||
      Array.isArray(row.metadata)
    ) {
      continue;
    }
    const metadata = row.metadata as Record<string, unknown>;
    if (metadata.source_event !== 'resources_persona_selected') continue;

    const persona = typeof metadata.persona === 'string' ? metadata.persona : null;
    if (!persona) continue;

    const key = `${row.cityId}:${persona}`;
    signals.set(key, (signals.get(key) ?? 0) + 1);
  }

  return signals;
}

function activeGapCells(row: CoverageRow): CoverageCell[] {
  if (row.verdict !== 'THIN') return [];
  return row.cells.filter((cell) => {
    const missingRequired = REQUIRED_STAGES.includes(cell.stage) && cell.total === 0;
    const underMin = cell.total < MIN_BLOCKS_PER_STAGE;
    return missingRequired || underMin;
  });
}

export async function ingestJourneyGapBacklog(now = new Date()) {
  invalidateResolver();
  const week = startOfIsoWeek(now);
  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  const trafficSignals = await loadPersonaTrafficSignals(now);

  let created = 0;
  let updated = 0;
  let reopened = 0;
  const detected = new Set<string>();

  for (const city of cities) {
    const coverage = await computeCityCoverage({ citySlug: city.slug, cityName: city.name });

    const stageResources = new Map<
      ResourceStage,
      Awaited<ReturnType<typeof getResourcesForCity>>
    >();
    for (const stage of [
      'PRE_ARRIVAL',
      'FIRST_30_DAYS',
      'FIRST_90_DAYS',
      'SETTLED',
      'ANYTIME',
    ] as ResourceStage[]) {
      stageResources.set(stage, await getResourcesForCity(city.slug, { stage }));
    }

    for (const row of coverage.rows) {
      const personaTraffic = trafficSignals.get(`${city.id}:${row.personaSlug}`) ?? 0;
      const traffic = trafficScore(personaTraffic);

      for (const cell of activeGapCells(row)) {
        const stageRows = stageResources.get(cell.stage) ?? [];
        const needsVerificationCount = stageRows.filter(
          (resource) => resource.trust.trustBand === 'NEEDS_VERIFICATION',
        ).length;
        const trustGap = trustGapScore(needsVerificationCount, stageRows.length);
        const severity = severityScore(cell);
        const stageCriticality = stageCriticalityScore(cell.stage);
        const priority = priorityScore({
          trafficScore: traffic,
          severityScore: severity,
          stageCriticalityScore: stageCriticality,
          trustGapScore: trustGap,
        });

        const where = {
          cityId_personaSlug_stage: {
            cityId: city.id,
            personaSlug: row.personaSlug,
            stage: cell.stage,
          },
        } as const;

        const existing = await db.journeyGapBacklog.findUnique({
          where,
          select: { id: true, status: true, slaDueAt: true },
        });

        const status: JourneyGapBacklogStatus =
          existing?.status === 'ASSIGNED' || existing?.status === 'IN_PROGRESS'
            ? existing.status
            : 'OPEN';

        if (existing && (existing.status === 'RESOLVED' || existing.status === 'DISMISSED')) {
          reopened += 1;
        }

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }

        const rowItem = await db.journeyGapBacklog.upsert({
          where,
          create: {
            cityId: city.id,
            personaSlug: row.personaSlug,
            personaLabel: row.label,
            stage: cell.stage,
            status: 'OPEN',
            priorityScore: priority,
            trafficScore: traffic,
            severityScore: severity,
            stageCriticalityScore: stageCriticality,
            trustGapScore: trustGap,
            slaDueAt: defaultSlaDueAt(priority, now),
            gapSummary: gapSummary(row.label, cell),
            firstDetectedAt: now,
            lastDetectedAt: now,
          },
          update: {
            status,
            priorityScore: priority,
            trafficScore: traffic,
            severityScore: severity,
            stageCriticalityScore: stageCriticality,
            trustGapScore: trustGap,
            gapSummary: gapSummary(row.label, cell),
            lastDetectedAt: now,
            resolvedAt:
              status === 'OPEN' || status === 'ASSIGNED' || status === 'IN_PROGRESS'
                ? null
                : undefined,
            slaDueAt: existing?.slaDueAt ?? defaultSlaDueAt(priority, now),
          },
          select: { id: true },
        });

        detected.add(rowItem.id);
      }
    }
  }

  const staleRows = await db.journeyGapBacklog.findMany({
    where: { status: { in: OPEN_STATUSES } },
    select: { id: true },
  });

  let autoClosed = 0;
  for (const stale of staleRows) {
    if (detected.has(stale.id)) continue;
    await db.journeyGapBacklog.update({
      where: { id: stale.id },
      data: {
        status: 'DISMISSED',
        notes: 'Auto-closed: coverage gap no longer present in latest run.',
        resolvedAt: now,
      },
    });
    autoClosed += 1;
  }

  return {
    generatedForWeek: week.toISOString(),
    scannedCities: cities.length,
    created,
    updated,
    reopened,
    autoClosed,
  };
}

export async function assignJourneyGapItem(params: {
  id: string;
  ownerUserId: string;
  reviewerId: string;
}) {
  const now = new Date();
  const item = await db.journeyGapBacklog.update({
    where: { id: params.id },
    data: {
      ownerUserId: params.ownerUserId,
      status: 'ASSIGNED',
      resolvedAt: null,
    },
    select: { id: true, cityId: true, personaSlug: true, stage: true },
  });

  await db.contentLog.create({
    data: {
      entityType: 'resource',
      entityId: `journey-gap:${item.cityId}:${item.personaSlug}:${item.stage}`,
      action: 'UPDATED',
      changedBy: params.reviewerId,
      metadata: {
        via: 'journey_gap_assignment',
        backlogId: item.id,
        ownerUserId: params.ownerUserId,
        changedAt: now.toISOString(),
      },
    },
  });
}

export async function setJourneyGapSla(params: { id: string; slaDueAt: Date; reviewerId: string }) {
  const now = new Date();
  const item = await db.journeyGapBacklog.update({
    where: { id: params.id },
    data: { slaDueAt: params.slaDueAt, resolvedAt: null },
    select: { id: true, cityId: true, personaSlug: true, stage: true },
  });

  await db.contentLog.create({
    data: {
      entityType: 'resource',
      entityId: `journey-gap:${item.cityId}:${item.personaSlug}:${item.stage}`,
      action: 'UPDATED',
      changedBy: params.reviewerId,
      metadata: {
        via: 'journey_gap_sla_update',
        backlogId: item.id,
        slaDueAt: params.slaDueAt.toISOString(),
        changedAt: now.toISOString(),
      },
    },
  });
}

export async function resolveJourneyGapItem(params: {
  id: string;
  status: 'RESOLVED' | 'DISMISSED';
  notes: string;
  reviewerId: string;
}) {
  const now = new Date();
  const item = await db.journeyGapBacklog.update({
    where: { id: params.id },
    data: {
      status: params.status,
      notes: params.notes || null,
      resolvedAt: now,
    },
    select: { id: true, cityId: true, personaSlug: true, stage: true },
  });

  await db.contentLog.create({
    data: {
      entityType: 'resource',
      entityId: `journey-gap:${item.cityId}:${item.personaSlug}:${item.stage}`,
      action: 'UPDATED',
      changedBy: params.reviewerId,
      metadata: {
        via: 'journey_gap_resolution',
        backlogId: item.id,
        resolutionStatus: params.status,
        notes: params.notes,
        changedAt: now.toISOString(),
      },
    },
  });
}
