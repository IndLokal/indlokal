import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

/**
 * Search communities by text query within a city.
 * Uses PostgreSQL full-text search (tsvector/tsquery) with ranking.
 * Falls back to ILIKE substring match if FTS returns no results.
 */
export async function searchCommunities(
  citySlug: string,
  query: string,
  limit = 10,
): Promise<CommunityListItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];

  const cityIds = [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];

  // PostgreSQL full-text search with ranking
  const rankedIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM communities
    WHERE city_id IN (${Prisma.join(cityIds)})
      AND status != 'INACTIVE'
      AND to_tsvector('english', name || ' ' || COALESCE(description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', name || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', ${trimmed})
    ) DESC
    LIMIT ${limit}
  `;

  let ids = rankedIds.map((r) => r.id);

  // Fallback to ILIKE for partial matches that FTS misses (e.g. "yoga" matching "yogalife")
  if (ids.length === 0) {
    const fallback = await db.community.findMany({
      where: {
        cityId: { in: cityIds },
        status: { not: 'INACTIVE' },
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      orderBy: { activityScore: 'desc' },
      take: limit,
    });
    ids = fallback.map((r) => r.id);
  }

  if (ids.length === 0) return [];

  const results = await db.community.findMany({
    where: { id: { in: ids } },
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
      claimState: true,
      memberCountApprox: true,
      logoUrl: true,
      lastActivityAt: true,
      languages: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
  });

  // Preserve rank order from full-text search
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  return results.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
}

/**
 * Search events by text query within a city.
 * Uses PostgreSQL full-text search with fallback to ILIKE.
 */
export async function searchEvents(
  citySlug: string,
  query: string,
  limit = 10,
): Promise<EventListItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];

  const cityIds = [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];

  const now = new Date();

  // PostgreSQL full-text search with ranking
  const rankedIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM events
    WHERE city_id IN (${Prisma.join(cityIds)})
      AND starts_at >= ${now}
      AND status != 'CANCELLED'
      AND to_tsvector('english', title || ' ' || COALESCE(description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', ${trimmed})
    ) DESC
    LIMIT ${limit}
  `;

  let ids = rankedIds.map((r) => r.id);

  // Fallback to ILIKE for partial matches
  if (ids.length === 0) {
    const fallback = await db.event.findMany({
      where: {
        cityId: { in: cityIds },
        startsAt: { gte: now },
        status: { not: 'CANCELLED' },
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    ids = fallback.map((r) => r.id);
  }

  if (ids.length === 0) return [];

  const results = await db.event.findMany({
    where: { id: { in: ids } },
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
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
    },
  });

  // Preserve rank order
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  return results.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
}
