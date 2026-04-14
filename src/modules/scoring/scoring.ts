import { db } from '@/lib/db';
import { SCORING } from '@/lib/config';
import { subDays } from 'date-fns';

// ─── Scoring weights (must sum to 1.0) ────────────────────────────────────
const WEIGHTS = {
  activity: 0.5,
  completeness: 0.3,
  trust: 0.2,
} as const;

/**
 * Compute activity score for a community (0-100).
 * Formula: f(events in last 90 days, last_update recency)
 */
export function computeActivityScore(input: {
  eventsLast90Days: number;
  lastActivityAt: Date | null;
}): number {
  const { eventsLast90Days, lastActivityAt } = input;
  const now = new Date();

  // Event count component (0-50 points) — logarithmic to avoid gaming
  const eventScore = Math.min(50, Math.log2(eventsLast90Days + 1) * 15);

  // Recency component (0-50 points) — decays over STALE_THRESHOLD_DAYS
  let recencyScore = 0;
  if (lastActivityAt) {
    const daysAgo = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 50 * (1 - daysAgo / SCORING.STALE_THRESHOLD_DAYS));
  }

  return Math.round((eventScore + recencyScore) * 100) / 100;
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

  const last30Map = new Map(eventCountsLast30.map((r) => [r.communityId, r._count._all]));
  const prior30Map = new Map(eventCountsPrior30.map((r) => [r.communityId, r._count._all]));

  let updated = 0;
  for (const c of communities) {
    const activityScore = computeActivityScore({
      eventsLast90Days: c._count.events,
      lastActivityAt: c.lastActivityAt,
    });

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

    await db.community.update({
      where: { id: c.id },
      data: { activityScore, completenessScore, trustScore, isTrending },
    });
    updated++;
  }

  return { updated };
}
