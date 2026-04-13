import { db } from '@/lib/db';
import { SCORING } from '@/lib/config';
import { subDays } from 'date-fns';

/**
 * Compute activity score for a community.
 * MVP formula: f(events in last 90 days, last_update recency)
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
 * Refresh scores for all active communities.
 * Intended to run as a cron job (daily or on content change).
 */
export async function refreshAllScores(): Promise<{ updated: number }> {
  const cutoff = subDays(new Date(), 90);

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
      categories: { select: { categoryId: true } },
      accessChannels: { select: { id: true } },
      _count: {
        select: { events: { where: { startsAt: { gte: cutoff } } } },
      },
    },
  });

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

    await db.community.update({
      where: { id: c.id },
      data: { activityScore, completenessScore },
    });
    updated++;
  }

  return { updated };
}
