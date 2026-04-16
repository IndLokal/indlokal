import { db } from '@/lib/db';
import { SCORING } from '@/lib/config';
import { subDays } from 'date-fns';

// ─── Scoring weights (must sum to 1.0) ────────────────────────────────────
const WEIGHTS = {
  activity: 0.5,
  completeness: 0.3,
  trust: 0.2,
} as const;

/** Pulse Score breakdown — stored in community.scoreBreakdown JSONB */
export type PulseScoreBreakdown = {
  pulseScore: number;
  activity: {
    total: number;
    eventFrequency: number;
    recency: number;
    engagement: number;
  };
  completeness: number;
  trust: number;
  isTrending: boolean;
  computedAt: string; // ISO 8601
};

/**
 * Compute activity score for a community (0-100).
 * Formula: f(events in last 90 days, last_update recency, views in last 30 days)
 */
export function computeActivityScore(input: {
  eventsLast90Days: number;
  lastActivityAt: Date | null;
  viewsLast30Days?: number;
}): number {
  const b = computeActivityBreakdown(input);
  return b.total;
}

/**
 * Compute activity score with full breakdown of sub-components.
 */
export function computeActivityBreakdown(input: {
  eventsLast90Days: number;
  lastActivityAt: Date | null;
  viewsLast30Days?: number;
}): { total: number; eventFrequency: number; recency: number; engagement: number } {
  const { eventsLast90Days, lastActivityAt, viewsLast30Days = 0 } = input;
  const now = new Date();

  // Event count component (0-50 points) — logarithmic to avoid gaming
  const eventFrequency = Math.round(Math.min(50, Math.log2(eventsLast90Days + 1) * 15) * 100) / 100;

  // Recency component (0-40 points) — decays over STALE_THRESHOLD_DAYS
  let recency = 0;
  if (lastActivityAt) {
    const daysAgo = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    recency =
      Math.round(Math.max(0, 40 * (1 - daysAgo / SCORING.STALE_THRESHOLD_DAYS)) * 100) / 100;
  }

  // Engagement component (0-10 points) — view count signal
  const engagement = Math.round(Math.min(10, Math.log2(viewsLast30Days + 1) * 3) * 100) / 100;

  const total = Math.round((eventFrequency + recency + engagement) * 100) / 100;

  return { total, eventFrequency, recency, engagement };
}

/**
 * Compute profile completeness score (0-100).
 */
export function computeCompletenessScore(input: {
  hasDescription: boolean;
  hasDescriptionLong: boolean;
  hasLogo: boolean;
  hasCoverImage: boolean;
  categoryCount: number;
  accessChannelCount: number;
  hasLanguages: boolean;
  hasPersonas: boolean;
}): number {
  let score = 0;
  if (input.hasDescription) score += 15;
  if (input.hasDescriptionLong) score += 10;
  if (input.hasLogo) score += 15;
  if (input.hasCoverImage) score += 10;
  if (input.categoryCount > 0) score += 15;
  if (input.accessChannelCount > 0) score += 20;
  if (input.hasLanguages) score += 10;
  if (input.hasPersonas) score += 5;
  return score;
}

/**
 * Compute trust score (0-100) from trust signals and claim state.
 *
 * Signals:
 * - ADMIN_VERIFIED trust signal: +50 pts (hard proof of admin review)
 * - CLAIMED claim state: +25 pts (community has an active owner)
 * - CLAIM_PENDING: +5 pts (someone cares enough to claim)
 * - SUBMITTER_VERIFIED: +15 pts
 * - Each additional trust signal beyond the first: +5 pts (max +15 extra)
 */
export function computeTrustScore(input: {
  trustSignalTypes: string[];
  claimState: string;
}): number {
  const { trustSignalTypes, claimState } = input;
  let score = 0;

  // Per-signal bonuses
  const unique = new Set(trustSignalTypes);
  if (unique.has('ADMIN_VERIFIED')) score += 50;
  if (unique.has('SUBMITTER_VERIFIED')) score += 15;

  // Bonus for multiple distinct signals (up to 3 extra)
  const extraSignals = Math.min(3, Math.max(0, unique.size - 1));
  score += extraSignals * 5;

  // Claim state bonus
  if (claimState === 'CLAIMED') score += 25;
  else if (claimState === 'CLAIM_PENDING') score += 5;

  return Math.min(100, score);
}

/**
 * Detect if a community is trending.
 * Trending = events in the last 30 days is ≥ 2× the events in the prior 30 days
 * AND at least 2 events in the recent period.
 */
export function detectTrending(input: {
  eventsLast30Days: number;
  eventsPrior30Days: number;
}): boolean {
  const { eventsLast30Days, eventsPrior30Days } = input;
  if (eventsLast30Days < 2) return false;
  if (eventsPrior30Days === 0) return eventsLast30Days >= 2;
  return eventsLast30Days >= 2 * eventsPrior30Days;
}

/**
 * Compute composite final score (0-100) from weighted sub-scores.
 */
export function computeFinalScore(input: {
  activityScore: number;
  completenessScore: number;
  trustScore: number;
}): number {
  const raw =
    input.activityScore * WEIGHTS.activity +
    input.completenessScore * WEIGHTS.completeness +
    input.trustScore * WEIGHTS.trust;
  return Math.round(raw * 100) / 100;
}

/**
 * Refresh scores for all active communities.
 * Intended to run as a cron job (daily or on content change).
 */
export async function refreshAllScores(): Promise<{ updated: number }> {
  const now = new Date();
  const cutoff90 = subDays(now, 90);
  const cutoff30 = subDays(now, 30);
  const cutoff60 = subDays(now, 60);

  const communities = await db.community.findMany({
    where: { status: { not: 'INACTIVE' } },
    select: {
      id: true,
      description: true,
      descriptionLong: true,
      logoUrl: true,
      coverImageUrl: true,
      languages: true,
      personaSegments: true,
      lastActivityAt: true,
      claimState: true,
      categories: { select: { categoryId: true } },
      accessChannels: { select: { id: true } },
      trustSignals: { select: { signalType: true } },
      _count: {
        select: {
          events: { where: { startsAt: { gte: cutoff90 } } },
        },
      },
    },
  });

  // Batch-fetch event counts for trending (last 30 vs prior 30)
  const eventCountsLast30 = await db.event.groupBy({
    by: ['communityId'],
    where: { startsAt: { gte: cutoff30 }, communityId: { not: null } },
    _count: { _all: true },
  });
  const eventCountsPrior30 = await db.event.groupBy({
    by: ['communityId'],
    where: { startsAt: { gte: cutoff60, lt: cutoff30 }, communityId: { not: null } },
    _count: { _all: true },
  });

  // Batch-fetch view counts per community from UserInteraction (last 30 days)
  const viewCounts = await db.userInteraction.groupBy({
    by: ['entityId'],
    where: {
      entityType: 'COMMUNITY',
      interactionType: 'VIEW',
      createdAt: { gte: cutoff30 },
    },
    _count: { _all: true },
  });

  const last30Map = new Map(eventCountsLast30.map((r) => [r.communityId, r._count._all]));
  const prior30Map = new Map(eventCountsPrior30.map((r) => [r.communityId, r._count._all]));
  const viewMap = new Map(viewCounts.map((r) => [r.entityId, r._count._all]));

  let updated = 0;
  for (const c of communities) {
    const activityBreakdown = computeActivityBreakdown({
      eventsLast90Days: c._count.events,
      lastActivityAt: c.lastActivityAt,
      viewsLast30Days: viewMap.get(c.id) ?? 0,
    });

    const activityScore = activityBreakdown.total;

    const completenessScore = computeCompletenessScore({
      hasDescription: !!c.description,
      hasDescriptionLong: !!c.descriptionLong,
      hasLogo: !!c.logoUrl,
      hasCoverImage: !!c.coverImageUrl,
      categoryCount: c.categories.length,
      accessChannelCount: c.accessChannels.length,
      hasLanguages: c.languages.length > 0,
      hasPersonas: c.personaSegments.length > 0,
    });

    const trustScore = computeTrustScore({
      trustSignalTypes: c.trustSignals.map((s) => s.signalType),
      claimState: c.claimState,
    });

    const isTrending = detectTrending({
      eventsLast30Days: last30Map.get(c.id) ?? 0,
      eventsPrior30Days: prior30Map.get(c.id) ?? 0,
    });

    const pulseScore = computeFinalScore({ activityScore, completenessScore, trustScore });

    const scoreBreakdown: PulseScoreBreakdown = {
      pulseScore,
      activity: activityBreakdown,
      completeness: completenessScore,
      trust: trustScore,
      isTrending,
      computedAt: new Date().toISOString(),
    };

    await db.community.update({
      where: { id: c.id },
      data: { activityScore, completenessScore, trustScore, isTrending, scoreBreakdown },
    });
    updated++;
  }

  return { updated };
}

/**
 * Refresh scores for a single community.
 * Call this after events are created, profiles edited, claims approved, etc.
 */
export async function refreshCommunityScore(communityId: string): Promise<void> {
  const now = new Date();
  const cutoff90 = subDays(now, 90);
  const cutoff30 = subDays(now, 30);
  const cutoff60 = subDays(now, 60);

  const c = await db.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      description: true,
      descriptionLong: true,
      logoUrl: true,
      coverImageUrl: true,
      languages: true,
      personaSegments: true,
      lastActivityAt: true,
      claimState: true,
      categories: { select: { categoryId: true } },
      accessChannels: { select: { id: true } },
      trustSignals: { select: { signalType: true } },
      _count: {
        select: {
          events: { where: { startsAt: { gte: cutoff90 } } },
        },
      },
    },
  });

  if (!c) return;

  const [eventsLast30, eventsPrior30, viewCount] = await Promise.all([
    db.event.count({
      where: { communityId, startsAt: { gte: cutoff30 } },
    }),
    db.event.count({
      where: { communityId, startsAt: { gte: cutoff60, lt: cutoff30 } },
    }),
    db.userInteraction.count({
      where: {
        entityType: 'COMMUNITY',
        entityId: communityId,
        interactionType: 'VIEW',
        createdAt: { gte: cutoff30 },
      },
    }),
  ]);

  const activityBreakdown = computeActivityBreakdown({
    eventsLast90Days: c._count.events,
    lastActivityAt: c.lastActivityAt,
    viewsLast30Days: viewCount,
  });

  const activityScore = activityBreakdown.total;

  const completenessScore = computeCompletenessScore({
    hasDescription: !!c.description,
    hasDescriptionLong: !!c.descriptionLong,
    hasLogo: !!c.logoUrl,
    hasCoverImage: !!c.coverImageUrl,
    categoryCount: c.categories.length,
    accessChannelCount: c.accessChannels.length,
    hasLanguages: c.languages.length > 0,
    hasPersonas: c.personaSegments.length > 0,
  });

  const trustScore = computeTrustScore({
    trustSignalTypes: c.trustSignals.map((s) => s.signalType),
    claimState: c.claimState,
  });

  const isTrending = detectTrending({
    eventsLast30Days: eventsLast30,
    eventsPrior30Days: eventsPrior30,
  });

  const pulseScore = computeFinalScore({ activityScore, completenessScore, trustScore });

  const scoreBreakdown: PulseScoreBreakdown = {
    pulseScore,
    activity: activityBreakdown,
    completeness: completenessScore,
    trust: trustScore,
    isTrending,
    computedAt: new Date().toISOString(),
  };

  await db.community.update({
    where: { id: communityId },
    data: { activityScore, completenessScore, trustScore, isTrending, scoreBreakdown },
  });
}
