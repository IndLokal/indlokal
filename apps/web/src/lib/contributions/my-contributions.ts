/**
 * My Contributions read model (PRD/TDD-0060).
 *
 * A single, serializable view of the things an authenticated user has
 * contributed to the directory. Unions two attribution sources:
 *
 *   1. Communities the user submitted   (Community.createdByUserId, source COMMUNITY_SUBMITTED)
 *   2. Suggestions the user reported     (ContentReport.reporterUserId, SUGGEST_* reports)
 *
 * Attribution is always the authenticated actor id (never a typed contact email).
 * Host-owned events (Event.createdByUserId) are intentionally excluded — those
 * belong to the host workspace, not the contributor list.
 *
 * Read-only. No mutations. Resilient to being awaited inside a try/catch.
 */
import { db } from '@/lib/db';
import { SATELLITE_TO_METRO } from '@/lib/config';

export type ContributionKind = 'COMMUNITY' | 'EVENT';
export type ContributionStatus = 'UNDER_REVIEW' | 'PUBLISHED' | 'NEEDS_CHANGES';

export interface MyContribution {
  /** Stable id, namespaced by source so community + report ids never collide. */
  id: string;
  kind: ContributionKind;
  title: string;
  status: ContributionStatus;
  /** Public link, present only when a published entity exists. */
  href: string | null;
  citySlug: string | null;
  createdAt: Date;
}

/** Maps a submitted community's status to a contributor-facing status. */
export function communityStatusToContribution(
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED' | 'CLAIMED',
): ContributionStatus {
  switch (status) {
    case 'ACTIVE':
    case 'CLAIMED':
      return 'PUBLISHED';
    case 'INACTIVE':
      return 'NEEDS_CHANGES';
    case 'UNVERIFIED':
    default:
      return 'UNDER_REVIEW';
  }
}

/** Maps a suggested event's moderation state to a contributor-facing status. */
export function eventModerationToContribution(
  state: 'PUBLISHED' | 'PENDING_REVIEW' | 'REJECTED' | null | undefined,
): ContributionStatus {
  switch (state) {
    case 'PUBLISHED':
      return 'PUBLISHED';
    case 'REJECTED':
      return 'NEEDS_CHANGES';
    case 'PENDING_REVIEW':
    default:
      return 'UNDER_REVIEW';
  }
}

export async function getMyContributions(
  userId: string,
  opts: { limit?: number } = {},
): Promise<MyContribution[]> {
  const limit = opts.limit ?? 50;

  const [submittedCommunities, suggestionReports] = await Promise.all([
    db.community.findMany({
      where: { createdByUserId: userId, source: 'COMMUNITY_SUBMITTED' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        city: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.contentReport.findMany({
      where: {
        reporterUserId: userId,
        reportType: { in: ['SUGGEST_EVENT', 'SUGGEST_COMMUNITY'] },
      },
      select: {
        id: true,
        reportType: true,
        suggestedName: true,
        createdAt: true,
        city: { select: { slug: true } },
        event: {
          select: {
            slug: true,
            moderationState: true,
            city: { select: { slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  const fromCommunities: MyContribution[] = submittedCommunities.map((c) => {
    const status = communityStatusToContribution(c.status);
    const citySlug = c.city?.slug ?? null;
    return {
      id: `community:${c.id}`,
      kind: 'COMMUNITY',
      title: c.name,
      status,
      href: status === 'PUBLISHED' && citySlug ? `/${citySlug}/communities/${c.slug}` : null,
      citySlug,
      createdAt: c.createdAt,
    };
  });

  const fromReports: MyContribution[] = suggestionReports.map((r) => {
    if (r.reportType === 'SUGGEST_EVENT') {
      const status = eventModerationToContribution(r.event?.moderationState);
      const eventCitySlug = r.event?.city?.slug ?? r.city?.slug ?? null;
      const metroSlug = eventCitySlug ? (SATELLITE_TO_METRO[eventCitySlug] ?? eventCitySlug) : null;
      return {
        id: `report:${r.id}`,
        kind: 'EVENT' as const,
        title: r.suggestedName ?? 'Suggested event',
        status,
        href:
          status === 'PUBLISHED' && r.event?.slug && metroSlug
            ? `/${metroSlug}/events/${r.event.slug}`
            : null,
        citySlug: eventCitySlug,
        createdAt: r.createdAt,
      };
    }
    // SUGGEST_COMMUNITY: a suggestion with no entity yet — always under review.
    return {
      id: `report:${r.id}`,
      kind: 'COMMUNITY' as const,
      title: r.suggestedName ?? 'Suggested community',
      status: 'UNDER_REVIEW' as const,
      href: null,
      citySlug: r.city?.slug ?? null,
      createdAt: r.createdAt,
    };
  });

  return [...fromCommunities, ...fromReports]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
