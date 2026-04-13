import { db } from '@/lib/db';
import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

/**
 * Search communities by text query within a city.
 * Uses PostgreSQL full-text search for MVP.
 */
export async function searchCommunities(
  citySlug: string,
  query: string,
  limit = 10,
): Promise<CommunityListItem[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];

  const cityIds = [city.id, ...city.satelliteCities.map((s) => s.id)];

  // MVP: simple ILIKE search. Migrate to full-text search with tsvector later.
  return db.community.findMany({
    where: {
      cityId: { in: cityIds },
      status: { not: 'INACTIVE' },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      activityScore: true,
      memberCountApprox: true,
      logoUrl: true,
      lastActivityAt: true,
      languages: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
    orderBy: { activityScore: 'desc' },
    take: limit,
  });
}

/**
 * Search events by text query within a city.
 */
export async function searchEvents(
  citySlug: string,
  query: string,
  limit = 10,
): Promise<EventListItem[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];

  const cityIds = [city.id, ...city.satelliteCities.map((s) => s.id)];

  return db.event.findMany({
    where: {
      cityId: { in: cityIds },
      startsAt: { gte: new Date() },
      status: { not: 'CANCELLED' },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
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
      community: { select: { name: true, slug: true } },
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
  });
}
