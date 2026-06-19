/**
 * Source reliability metrics for pipeline quality gates.
 *
 * Aggregates review outcomes by source type and lane so planner/orchestrator
 * can apply lightweight confidence adjustments from observed approval history.
 */
import { db } from '@/lib/db';
import type { PipelineEntityType, PipelineSourceType, PipelineItemStatus } from '@prisma/client';
import type { PipelineLane } from '../types';

export type SourceReliabilityKey = `${PipelineSourceType}:${PipelineLane}`;

export type SourceReliabilityStat = {
  key: SourceReliabilityKey;
  sourceType: PipelineSourceType;
  lane: PipelineLane;
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
  totalReviewed: number;
  approvalRate: number;
  confidenceAdjustment: number;
};

function computeConfidenceAdjustment(approvalRate: number, totalReviewed: number): number {
  if (totalReviewed < 5) return 0;
  if (approvalRate >= 0.8) return 0.05;
  if (approvalRate <= 0.3) return -0.05;
  return 0;
}

/** Apply bounded confidence adjustment and round to two decimals. */
export function applySourceConfidenceAdjustment(confidence: number, adjustment: number): number {
  return Math.max(0, Math.min(1, Math.round((confidence + adjustment) * 100) / 100));
}

/** Map entity types to canonical source lanes. */
export function getSourceLaneFromEntityType(entityType: PipelineEntityType): PipelineLane {
  if (entityType === 'EVENT') return 'EVENT';
  if (entityType === 'COMMUNITY') return 'COMMUNITY';
  return 'RESOURCE';
}

/** Build stable map keys for per-source and per-lane reliability stats. */
export function buildSourceReliabilityKey(
  sourceType: PipelineSourceType,
  lane: PipelineLane,
): SourceReliabilityKey {
  return `${sourceType}:${lane}`;
}

type SourceReliabilityGroupRow = {
  sourceType: PipelineSourceType;
  entityType: PipelineEntityType;
  status: PipelineItemStatus;
  _count: { _all: number };
};

/** Convert grouped DB rows into per-source, per-lane reliability stats. */
export function buildSourceReliabilityStatsFromRows(
  grouped: SourceReliabilityGroupRow[],
): SourceReliabilityStat[] {
  const statsMap = new Map<
    SourceReliabilityKey,
    Omit<SourceReliabilityStat, 'approvalRate' | 'confidenceAdjustment'>
  >();

  for (const row of grouped) {
    const lane = getSourceLaneFromEntityType(row.entityType);
    const key = buildSourceReliabilityKey(row.sourceType, lane);
    const existing = statsMap.get(key) ?? {
      key,
      sourceType: row.sourceType,
      lane,
      pending: 0,
      approved: 0,
      rejected: 0,
      merged: 0,
      totalReviewed: 0,
    };

    if (row.status === 'PENDING') existing.pending += row._count._all;
    if (row.status === 'APPROVED') existing.approved += row._count._all;
    if (row.status === 'REJECTED') existing.rejected += row._count._all;
    if (row.status === 'MERGED') existing.merged += row._count._all;

    existing.totalReviewed = existing.approved + existing.rejected + existing.merged;
    statsMap.set(key, existing);
  }

  return [...statsMap.values()]
    .map((stat) => {
      const denominator = stat.approved + stat.rejected;
      const approvalRate = denominator > 0 ? stat.approved / denominator : 0;
      return {
        ...stat,
        approvalRate,
        confidenceAdjustment: computeConfidenceAdjustment(approvalRate, stat.totalReviewed),
      };
    })
    .sort(
      (a, b) =>
        b.totalReviewed - a.totalReviewed ||
        a.sourceType.localeCompare(b.sourceType) ||
        a.lane.localeCompare(b.lane),
    );
}

/** Query grouped review outcomes and return normalized reliability stats. */
export async function getSourceReliabilityStats(): Promise<SourceReliabilityStat[]> {
  const grouped = await db.pipelineItem.groupBy({
    by: ['sourceType', 'entityType', 'status'],
    _count: { _all: true },
  });

  return buildSourceReliabilityStatsFromRows(grouped);
}

/** Convenience map view of source reliability keyed by sourceType:lane. */
export async function getSourceReliabilityMap(): Promise<
  Map<SourceReliabilityKey, SourceReliabilityStat>
> {
  const stats = await getSourceReliabilityStats();
  return new Map(stats.map((stat) => [stat.key, stat]));
}
