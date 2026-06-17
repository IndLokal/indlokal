import { db } from '@/lib/db';
import { computeCityCoverage } from '@/modules/journeys';
import { evaluateResourceFreshness } from './freshness-lifecycle';
import { projectResourceTrust } from './trust-read-model';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export interface Section17OpsReadout {
  generatedAt: string;
  lookbackDays: number;
  trustedJourneyResourceCoveragePct: number;
  resourcesWithinTtlPct: number;
  resourcesWithProvenanceMetadataPct: number;
  staleExposureRatePct: number;
  outdatedCorrectionTurnaroundDays: number;
  trustBandActionRatePct: {
    strongSource: number;
    sourceSupported: number;
    needsVerification: number;
  };
  antiMetrics: {
    staleActionSharePct: number;
    overdueReverificationRatePct: number;
    overdueJourneyGapBacklogRatePct: number;
  };
}

export async function getSection17OpsReadout(now = new Date()): Promise<Section17OpsReadout> {
  const lookbackDays = 30;
  const since = addDays(now, -lookbackDays);

  const [
    cities,
    resources,
    recentInteractions,
    resolvedQueueItems,
    openReverification,
    openJourneyGaps,
  ] = await Promise.all([
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.resource.findMany({
      where: { isHidden: false },
      select: {
        id: true,
        source: true,
        resourceType: true,
        metadata: true,
        lastReviewedAt: true,
        reviewCadenceDays: true,
        hiddenReason: true,
        isHidden: true,
        isEssential: true,
        lifecycleStage: true,
      },
    }),
    db.userInteraction.findMany({
      where: {
        entityType: 'RESOURCE',
        createdAt: { gte: since },
        interactionType: { in: ['VIEW', 'CLICK_ACCESS', 'SAVE'] },
      },
      select: {
        entityId: true,
        interactionType: true,
        metadata: true,
      },
    }),
    db.resourceReverificationQueue.findMany({
      where: {
        status: 'RESOLVED',
        updatedAt: { gte: since },
      },
      select: {
        firstQueuedAt: true,
        lastStateChangedAt: true,
      },
    }),
    db.resourceReverificationQueue.findMany({
      where: { status: { in: ['OPEN', 'ASSIGNED'] } },
      select: { slaDueAt: true },
    }),
    db.journeyGapBacklog.findMany({
      where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      select: { slaDueAt: true },
    }),
  ]);

  let personaTotal = 0;
  let readyTotal = 0;
  for (const city of cities) {
    const report = await computeCityCoverage({ citySlug: city.slug, cityName: city.name });
    personaTotal += report.personaCount;
    readyTotal += report.readyCount;
  }

  let inTtlCount = 0;
  let provenanceCount = 0;
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

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
    if (freshness.state === 'IN_TTL') inTtlCount += 1;

    const metadata = asObject(resource.metadata);
    const trustMeta = asObject(metadata?.trust);
    if (trustMeta || resource.lastReviewedAt) provenanceCount += 1;
  }

  const trustBandTotals = {
    STRONG_SOURCE: { total: 0, action: 0 },
    SOURCE_SUPPORTED: { total: 0, action: 0 },
    NEEDS_VERIFICATION: { total: 0, action: 0 },
  };

  let staleActions = 0;
  let totalActions = 0;
  let staleExposureClicks = 0;
  let essentialsClicks = 0;

  for (const interaction of recentInteractions) {
    const resource = resourceById.get(interaction.entityId);
    if (!resource) continue;

    const trust = projectResourceTrust({
      source: resource.source,
      resourceType: resource.resourceType,
      metadata: resource.metadata,
      lastReviewedAt: resource.lastReviewedAt,
    });

    trustBandTotals[trust.trustBand].total += 1;

    if (interaction.interactionType === 'CLICK_ACCESS' || interaction.interactionType === 'SAVE') {
      trustBandTotals[trust.trustBand].action += 1;
      totalActions += 1;

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
      if (freshness.state !== 'IN_TTL') staleActions += 1;
    }

    if (interaction.interactionType === 'CLICK_ACCESS') {
      const metadata = asObject(interaction.metadata);
      if (metadata?.source_event === 'resources_essentials_click') {
        essentialsClicks += 1;
        if (metadata.is_stale === true) staleExposureClicks += 1;
      }
    }
  }

  const correctionTurnaroundDays = resolvedQueueItems.map(
    (item) =>
      (item.lastStateChangedAt.getTime() - item.firstQueuedAt.getTime()) / (24 * 60 * 60 * 1000),
  );

  const overdueReverification = openReverification.filter(
    (item) => item.slaDueAt && item.slaDueAt.getTime() < now.getTime(),
  ).length;
  const overdueJourneyGaps = openJourneyGaps.filter(
    (item) => item.slaDueAt && item.slaDueAt.getTime() < now.getTime(),
  ).length;

  return {
    generatedAt: now.toISOString(),
    lookbackDays,
    trustedJourneyResourceCoveragePct: pct(readyTotal, personaTotal),
    resourcesWithinTtlPct: pct(inTtlCount, resources.length),
    resourcesWithProvenanceMetadataPct: pct(provenanceCount, resources.length),
    staleExposureRatePct: pct(staleExposureClicks, essentialsClicks),
    outdatedCorrectionTurnaroundDays: avg(correctionTurnaroundDays),
    trustBandActionRatePct: {
      strongSource: pct(trustBandTotals.STRONG_SOURCE.action, trustBandTotals.STRONG_SOURCE.total),
      sourceSupported: pct(
        trustBandTotals.SOURCE_SUPPORTED.action,
        trustBandTotals.SOURCE_SUPPORTED.total,
      ),
      needsVerification: pct(
        trustBandTotals.NEEDS_VERIFICATION.action,
        trustBandTotals.NEEDS_VERIFICATION.total,
      ),
    },
    antiMetrics: {
      staleActionSharePct: pct(staleActions, totalActions),
      overdueReverificationRatePct: pct(overdueReverification, openReverification.length),
      overdueJourneyGapBacklogRatePct: pct(overdueJourneyGaps, openJourneyGaps.length),
    },
  };
}
