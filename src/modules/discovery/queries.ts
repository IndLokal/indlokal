import { db } from '@/lib/db';
import { getEventsThisWeek } from '@/modules/event/queries';
import { getCommunitiesByCity } from '@/modules/community/queries';
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
      satelliteCities: { select: { id: true } },
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
