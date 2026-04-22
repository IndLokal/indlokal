import { db, resolveCityIds } from '@/lib/db';
import { getEventsThisWeek } from '@/modules/event/queries';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { eventListSelect } from '@/modules/event/queries';
import { subDays } from 'date-fns';
import { unstable_cache } from 'next/cache';
import type { CityFeedData } from './types';

/**
 * Assemble the full city feed — the primary discovery surface.
 * Cached for 5 minutes with tag-based invalidation.
 */
export const getCityFeed = unstable_cache(
  async (citySlug: string): Promise<CityFeedData | null> => {
    return _getCityFeed(citySlug);
  },
  ['city-feed'],
  { revalidate: 300, tags: ['city-feed'] },
);

async function _getCityFeed(citySlug: string): Promise<CityFeedData | null> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      state: true,
      diasporaDensityEstimate: true,
      isActive: true,
      isMetroPrimary: true,
      satelliteCities: { select: { id: true }, where: { isActive: true } },
    },
  });

  if (!city || !city.isActive) return null;

  const cityIds = [city.id, ...city.satelliteCities.map((s) => s.id)];

  // Parallel data fetching
  const [thisWeek, activeCommunities, recentPastEvents, categoryRows, counts] = await Promise.all([
    getEventsThisWeek(citySlug),

    getCommunitiesByCity(citySlug, { limit: 8 }),

    // Past events from last 30 days — "recently happened"
    db.event.findMany({
      where: {
        cityId: { in: cityIds },
        startsAt: { lt: new Date(), gte: subDays(new Date(), 30) },
        status: 'PAST',
      },
      select: {
        id: true,
        title: true,
        slug: true,
        startsAt: true,
        endsAt: true,
        venueName: true,
        isOnline: true,
        cost: true,
        imageUrl: true,
        isRecurring: true,
        community: { select: { name: true, slug: true } },
        city: { select: { name: true, slug: true } },
        categories: {
          select: { category: { select: { name: true, slug: true, icon: true } } },
        },
      },
      orderBy: { startsAt: 'desc' },
      take: 6,
    }),

    // Categories with community counts for "Browse by Category" grid
    db.category.findMany({
      where: {
        type: 'CATEGORY',
        communities: { some: { community: { cityId: { in: cityIds } } } },
      },
      select: {
        name: true,
        slug: true,
        icon: true,
        _count: {
          select: {
            communities: {
              where: { community: { cityId: { in: cityIds }, status: { not: 'INACTIVE' } } },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),

    // Aggregate counts
    Promise.all([
      db.community.count({ where: { cityId: { in: cityIds }, status: { not: 'INACTIVE' } } }),
      db.event.count({
        where: { cityId: { in: cityIds }, startsAt: { gte: new Date() }, status: 'UPCOMING' },
      }),
      db.communityCategory.findMany({
        where: { community: { cityId: { in: cityIds } } },
        select: { categoryId: true },
        distinct: ['categoryId'],
      }),
    ]).then(([communities, upcomingEvents, categoriesRaw]) => ({
      communities,
      upcomingEvents,
      categories: categoriesRaw.length,
    })),
  ]);

  return {
    city: {
      name: city.name,
      slug: city.slug,
      state: city.state,
      diasporaDensityEstimate: city.diasporaDensityEstimate,
    },
    thisWeek,
    activeCommunities,
    recentPastEvents,
    categories: categoryRows.map((c) => ({
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      communityCount: c._count.communities,
    })),
    counts,
  };
}

// ─── API-level queries (no next/cache wrapper) ────────────────────────────

const citySelect = {
  id: true,
  name: true,
  slug: true,
  state: true,
  country: true,
  isActive: true,
  isMetroPrimary: true,
  timezone: true,
  diasporaDensityEstimate: true,
  latitude: true,
  longitude: true,
} as const;

/** All active cities ordered by name — powers GET /api/v1/cities. */
export async function getCitiesList() {
  return db.city.findMany({
    where: { isActive: true },
    select: citySelect,
    orderBy: { name: 'asc' },
  });
}

/** City detail with counts + category grid — powers GET /api/v1/cities/:slug. */
export async function getCityDetail(slug: string) {
  const city = await db.city.findUnique({
    where: { slug },
    select: {
      ...citySelect,
      satelliteCities: { select: { id: true }, where: { isActive: true } },
    },
  });
  if (!city || !city.isActive) return null;

  const cityIds = [city.id, ...city.satelliteCities.map((s) => s.id)];

  const [counts, categoryRows] = await Promise.all([
    Promise.all([
      db.community.count({ where: { cityId: { in: cityIds }, status: { not: 'INACTIVE' } } }),
      db.event.count({
        where: { cityId: { in: cityIds }, startsAt: { gte: new Date() }, status: 'UPCOMING' },
      }),
      db.communityCategory.findMany({
        where: { community: { cityId: { in: cityIds } } },
        select: { categoryId: true },
        distinct: ['categoryId'],
      }),
    ]).then(([communities, upcomingEvents, cats]) => ({
      communities,
      upcomingEvents,
      categories: cats.length,
    })),
    db.category.findMany({
      where: {
        type: 'CATEGORY',
        communities: { some: { community: { cityId: { in: cityIds } } } },
      },
      select: {
        name: true,
        slug: true,
        icon: true,
        _count: {
          select: {
            communities: {
              where: { community: { cityId: { in: cityIds }, status: { not: 'INACTIVE' } } },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { satelliteCities: _sat, ...rest } = city;
  return {
    ...rest,
    counts,
    categories: categoryRows.map((c) => ({
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      communityCount: c._count.communities,
    })),
  };
}

const trendingCommunitySelect = {
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
} as const;

/** Trending communities + upcoming events — powers GET /api/v1/discovery/:citySlug/trending. */
export async function getTrending(citySlug: string) {
  const cityIds = await resolveCityIds(citySlug);
  if (!cityIds.length) return null;

  const [communities, events, categoryRows] = await Promise.all([
    db.community.findMany({
      where: {
        cityId: { in: cityIds },
        isTrending: true,
        status: { not: 'INACTIVE' },
        mergedIntoId: null,
      },
      select: {
        ...trendingCommunitySelect,
        _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
      },
      orderBy: { activityScore: 'desc' },
      take: 10,
    }),
    db.event.findMany({
      where: {
        cityId: { in: cityIds },
        startsAt: { gte: new Date() },
        status: 'UPCOMING',
      },
      select: eventListSelect,
      orderBy: { startsAt: 'asc' },
      take: 10,
    }),
    db.category.findMany({
      where: {
        type: 'CATEGORY',
        communities: { some: { community: { cityId: { in: cityIds } } } },
      },
      select: {
        name: true,
        slug: true,
        icon: true,
        _count: {
          select: {
            communities: {
              where: { community: { cityId: { in: cityIds }, status: { not: 'INACTIVE' } } },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    }),
  ]);

  return {
    communities,
    events,
    categories: categoryRows.map((c) => ({
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      communityCount: c._count.communities,
    })),
  };
}
