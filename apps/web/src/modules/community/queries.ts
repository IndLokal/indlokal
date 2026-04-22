import { db, resolveCityIds } from '@/lib/db';
import type { CommunityWithRelations, CommunityListItem } from './types';

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
