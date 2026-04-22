import { db, resolveCityIds } from '@/lib/db';
import type {
  CommunityWithRelations,
  CommunityListItem,
  CommunityDetailRow,
  CommunitySummaryRow,
} from './types';

/**
 * Get a single community with all relations for the detail page.
 * Includes past events for credibility (event history).
 */
export async function getCommunityBySlug(slug: string): Promise<CommunityWithRelations | null> {
  return db.community.findFirst({
    where: { slug, status: { not: 'INACTIVE' }, mergedIntoId: null },
    include: {
      city: true,
      categories: { include: { category: true } },
      accessChannels: { orderBy: { isPrimary: 'desc' } },
      events: {
        orderBy: { startsAt: 'desc' },
        take: 30,
      },
    },
  });
}

export async function getCommunityRedirectTarget(
  slug: string,
): Promise<{ citySlug: string; slug: string } | null> {
  const community = await db.community.findFirst({
    where: {
      slug,
      status: 'INACTIVE',
      mergedIntoId: { not: null },
    },
    select: {
      mergedInto: {
        select: {
          slug: true,
          city: { select: { slug: true } },
        },
      },
    },
  });

  if (!community?.mergedInto) return null;

  return {
    citySlug: community.mergedInto.city.slug,
    slug: community.mergedInto.slug,
  };
}

/**
 * Get communities for a city, ordered by activity score.
 * Includes metro-region satellite cities.
 */
export async function getCommunitiesByCity(
  citySlug: string,
  options?: {
    categorySlug?: string;
    limit?: number;
    offset?: number;
  },
): Promise<CommunityListItem[]> {
  const cityIds = await resolveCityIds(citySlug);
  if (cityIds.length === 0) return [];

  return db.community.findMany({
    where: {
      cityId: { in: cityIds },
      status: { not: 'INACTIVE' },
      mergedIntoId: null,
      ...(options?.categorySlug && {
        categories: { some: { category: { slug: options.categorySlug } } },
      }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      activityScore: true,
      completenessScore: true,
      trustScore: true,
      isTrending: true,
      memberCountApprox: true,
      logoUrl: true,
      lastActivityAt: true,
      languages: true,
      claimState: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
    orderBy: { activityScore: 'desc' },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });
}

/**
 * Cursor-paginated community list — powers GET /api/v1/discovery/:citySlug/communities.
 */
export async function getCommunitiesPage(
  citySlug: string,
  opts: {
    cursor?: string;
    limit: number;
    categorySlug?: string;
  },
): Promise<{ items: CommunityListItem[]; hasMore: boolean }> {
  const cityIds = await resolveCityIds(citySlug);
  if (!cityIds.length) return { items: [], hasMore: false };

  const rows = await db.community.findMany({
    where: {
      cityId: { in: cityIds },
      status: { not: 'INACTIVE' },
      mergedIntoId: null,
      ...(opts.categorySlug && {
        categories: { some: { category: { slug: opts.categorySlug } } },
      }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      activityScore: true,
      completenessScore: true,
      trustScore: true,
      isTrending: true,
      memberCountApprox: true,
      logoUrl: true,
      lastActivityAt: true,
      languages: true,
      claimState: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
    orderBy: [{ activityScore: 'desc' }, { id: 'asc' }],
    take: opts.limit + 1,
    ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
  });

  const hasMore = rows.length > opts.limit;
  return { items: hasMore ? rows.slice(0, opts.limit) : rows, hasMore };
}

const communityDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  descriptionLong: true,
  status: true,
  claimState: true,
  logoUrl: true,
  coverImageUrl: true,
  personaSegments: true,
  languages: true,
  foundedYear: true,
  memberCountApprox: true,
  activityScore: true,
  completenessScore: true,
  trustScore: true,
  isTrending: true,
  lastActivityAt: true,
  city: { select: { name: true, slug: true } },
  categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
  accessChannels: {
    select: {
      id: true,
      channelType: true,
      url: true,
      label: true,
      isPrimary: true,
      isVerified: true,
    },
    orderBy: { isPrimary: 'desc' as const },
  },
  trustSignals: {
    select: { id: true, signalType: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
  _count: {
    select: {
      events: { where: { startsAt: { gte: new Date() }, status: { not: 'CANCELLED' as const } } },
    },
  },
} as const;

/**
 * Full community detail for GET /api/v1/communities/:slug.
 */
export async function getCommunityDetail(slug: string): Promise<CommunityDetailRow | null> {
  return db.community.findFirst({
    where: { slug, status: { not: 'INACTIVE' }, mergedIntoId: null },
    select: communityDetailSelect,
  }) as Promise<CommunityDetailRow | null>;
}

/**
 * Related communities via RelationshipEdge. Returns up to `limit` (default 5)
 * communities connected to the given community id (either direction).
 *
 * Single round-trip: pulls edges with both source/target community payloads
 * pre-joined, then projects out the "other" side and de-duplicates.
 */
export async function getRelatedCommunities(
  communityId: string,
  limit = 5,
): Promise<CommunitySummaryRow[]> {
  const relatedSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    logoUrl: true,
    memberCountApprox: true,
    status: true,
    mergedIntoId: true,
    city: { select: { name: true, slug: true } },
    categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
    _count: {
      select: {
        events: { where: { startsAt: { gte: new Date() }, status: { not: 'CANCELLED' } } },
      },
    },
  } as const;

  const edges = await db.relationshipEdge.findMany({
    where: {
      OR: [{ sourceCommunityId: communityId }, { targetCommunityId: communityId }],
    },
    select: {
      sourceCommunityId: true,
      targetCommunityId: true,
      sourceCommunity: { select: relatedSelect },
      targetCommunity: { select: relatedSelect },
    },
    orderBy: { strength: 'desc' },
    take: limit * 2, // pad in case some get filtered (INACTIVE / merged / dupes)
  });

  const seen = new Set<string>();
  const out: CommunitySummaryRow[] = [];
  for (const edge of edges) {
    const other =
      edge.sourceCommunityId === communityId ? edge.targetCommunity : edge.sourceCommunity;
    if (!other) continue;
    if (other.status === 'INACTIVE' || other.mergedIntoId) continue;
    if (seen.has(other.id)) continue;
    seen.add(other.id);
    // Strip the fields we only needed for filtering.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, mergedIntoId: _m, ...row } = other;
    out.push(row as unknown as CommunitySummaryRow);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Follow a community (upsert SavedCommunity). Idempotent.
 */
export async function followCommunity(userId: string, communityId: string): Promise<void> {
  await db.savedCommunity.upsert({
    where: { userId_communityId: { userId, communityId } },
    create: { userId, communityId },
    update: {},
  });
}

/**
 * Unfollow a community. Idempotent.
 */
export async function unfollowCommunity(userId: string, communityId: string): Promise<void> {
  await db.savedCommunity.deleteMany({ where: { userId, communityId } });
}

/**
 * Check whether a user follows a community.
 */
export async function isCommunityFollowed(userId: string, communityId: string): Promise<boolean> {
  const row = await db.savedCommunity.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { userId: true },
  });
  return row !== null;
}

export interface SavedCommunityRow {
  communityId: string;
  savedAt: Date;
  community: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    memberCountApprox: number | null;
    city: { name: string; slug: string };
  };
}

/**
 * Cursor-paginated list of communities saved by a user.
 * Cursor is the communityId of the last seen item.
 */
export async function getSavedCommunities(
  userId: string,
  opts: { cursor?: string; limit: number },
): Promise<{ items: SavedCommunityRow[]; hasMore: boolean }> {
  const rows = await db.savedCommunity.findMany({
    where: { userId },
    select: {
      communityId: true,
      savedAt: true,
      community: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          memberCountApprox: true,
          city: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor && {
      cursor: { userId_communityId: { userId, communityId: opts.cursor } },
      skip: 1,
    }),
  });
  const hasMore = rows.length > opts.limit;
  return { items: hasMore ? rows.slice(0, opts.limit) : rows, hasMore };
}
