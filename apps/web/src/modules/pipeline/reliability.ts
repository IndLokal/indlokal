import { db } from '@/lib/db';
import type { PipelineSourceType } from '@prisma/client';

export type SourceReliabilityStat = {
  sourceType: PipelineSourceType;
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

export function applySourceConfidenceAdjustment(confidence: number, adjustment: number): number {
  return Math.max(0, Math.min(1, Math.round((confidence + adjustment) * 100) / 100));
}

export async function getSourceReliabilityStats(): Promise<SourceReliabilityStat[]> {
  const grouped = await db.pipelineItem.groupBy({
    by: ['sourceType', 'status'],
    _count: { _all: true },
  });

  const statsMap = new Map<
    PipelineSourceType,
    Omit<SourceReliabilityStat, 'approvalRate' | 'confidenceAdjustment'>
  >();

  for (const row of grouped) {
    const existing = statsMap.get(row.sourceType) ?? {
      sourceType: row.sourceType,
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
    statsMap.set(row.sourceType, existing);
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
    .sort((a, b) => b.totalReviewed - a.totalReviewed || a.sourceType.localeCompare(b.sourceType));
}

export async function getSourceReliabilityMap(): Promise<
  Map<PipelineSourceType, SourceReliabilityStat>
> {
  const stats = await getSourceReliabilityStats();
  return new Map(stats.map((stat) => [stat.sourceType, stat]));
}
