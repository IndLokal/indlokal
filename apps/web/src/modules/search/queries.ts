import { db, resolveCityIds } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

export type SearchResultRow =
  | { type: 'COMMUNITY'; item: CommunityListItem & { _count: { events: number } } }
  | { type: 'EVENT'; item: EventListItem };

export interface SearchAllOptions {
  q: string;
  citySlug?: string;
  categorySlug?: string;
  from?: Date;
  to?: Date;
  type?: 'COMMUNITY' | 'EVENT' | 'ALL';
  limit?: number;
  /** Opaque offset cursor — base64-encoded integer offset. */
  cursor?: string;
}

export interface SearchAllResult {
  items: SearchResultRow[];
  nextCursor?: string;
}

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

  const cityIds = await resolveCityIds(citySlug);
  if (cityIds.length === 0) return [];

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

  const cityIds = await resolveCityIds(citySlug);
  if (cityIds.length === 0) return [];

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

/**
 * Return autocomplete suggestions for a partial query.
 * Combines approved keywords and matching community/event names.
 */
export async function getSuggestions(
  q: string,
  citySlug?: string,
  limit = 8,
): Promise<Array<{ text: string; type: 'COMMUNITY' | 'EVENT' | 'ALL' }>> {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 1) return [];

  const cityIds = citySlug ? await resolveCityIds(citySlug) : [];

  // 1. Approved keywords matching the prefix
  const keywords = await db.keywordSuggestion.findMany({
    where: {
      status: 'APPROVED',
      normalizedKeyword: { startsWith: trimmed.toLowerCase() },
    },
    orderBy: [{ confidence: 'desc' }, { sourceCount: 'desc' }],
    take: limit,
    select: { keyword: true },
  });

  const results: Array<{ text: string; type: 'COMMUNITY' | 'EVENT' | 'ALL' }> = keywords.map(
    (k) => ({ text: k.keyword, type: 'ALL' }),
  );

  if (results.length >= limit) return results.slice(0, limit);
  const remaining = limit - results.length;
  const keywordSet = new Set(results.map((r) => r.text.toLowerCase()));

  // 2. Community names matching the prefix
  const communityWhere: Prisma.CommunityWhereInput = {
    name: { startsWith: trimmed, mode: 'insensitive' },
    status: { not: 'INACTIVE' },
    ...(cityIds.length > 0 && { cityId: { in: cityIds } }),
  };
  const communities = await db.community.findMany({
    where: communityWhere,
    orderBy: { activityScore: 'desc' },
    take: remaining,
    select: { name: true },
  });
  for (const c of communities) {
    if (!keywordSet.has(c.name.toLowerCase())) {
      results.push({ text: c.name, type: 'COMMUNITY' });
      keywordSet.add(c.name.toLowerCase());
    }
  }

  if (results.length >= limit) return results.slice(0, limit);
  const remaining2 = limit - results.length;

  // 3. Upcoming event titles matching the prefix
  const eventWhere: Prisma.EventWhereInput = {
    title: { startsWith: trimmed, mode: 'insensitive' },
    status: { not: 'CANCELLED' },
    startsAt: { gte: new Date() },
    ...(cityIds.length > 0 && { cityId: { in: cityIds } }),
  };
  const events = await db.event.findMany({
    where: eventWhere,
    orderBy: { startsAt: 'asc' },
    take: remaining2,
    select: { title: true },
  });
  for (const e of events) {
    if (!keywordSet.has(e.title.toLowerCase())) {
      results.push({ text: e.title, type: 'EVENT' });
    }
  }

  return results.slice(0, limit);
}

/**
 * Return trending search terms — approved keywords ordered by confidence.
 * Falls back to trending community names if no keywords exist.
 */
export async function getTrendingKeywords(citySlug?: string, limit = 10): Promise<string[]> {
  const cityIds = citySlug ? await resolveCityIds(citySlug) : [];

  const keywords = await db.keywordSuggestion.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ confidence: 'desc' }, { sourceCount: 'desc' }],
    take: limit,
    select: { keyword: true },
  });

  if (keywords.length > 0) {
    return keywords.map((k) => k.keyword);
  }

  // Fallback: names of trending communities
  const trendingWhere: Prisma.CommunityWhereInput = {
    isTrending: true,
    status: { not: 'INACTIVE' },
    ...(cityIds.length > 0 && { cityId: { in: cityIds } }),
  };
  const communities = await db.community.findMany({
    where: trendingWhere,
    orderBy: { activityScore: 'desc' },
    take: limit,
    select: { name: true },
  });

  return communities.map((c) => c.name);
}

/**
 * Combined full-text search across communities and/or events.
 * Results are interleaved in relevance order (communities first, then events).
 * Cursor is a base64-encoded offset integer for simple pagination.
 */
export async function searchAll(opts: SearchAllOptions): Promise<SearchAllResult> {
  const { q, citySlug, categorySlug, from, to, type = 'ALL', limit = 20, cursor } = opts;

  const offset = cursor ? parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10) : 0;
  const fetchLimit = limit + 1; // fetch one extra to detect hasMore

  const communityItems: SearchResultRow[] = [];
  const eventItems: SearchResultRow[] = [];

  if (type === 'COMMUNITY' || type === 'ALL') {
    const communities = await searchCommunities(citySlug ?? '', q, fetchLimit + offset);
    let filtered = communities;
    if (categorySlug) {
      filtered = filtered.filter((c) =>
        c.categories.some((cc) => cc.category.slug === categorySlug),
      );
    }
    const sliced = filtered.slice(offset);
    for (const c of sliced) {
      communityItems.push({
        type: 'COMMUNITY',
        item: c as CommunityListItem & { _count: { events: number } },
      });
    }
  }

  if (type === 'EVENT' || type === 'ALL') {
    const events = await searchEvents(citySlug ?? '', q, fetchLimit + offset);
    let filtered = events;
    if (categorySlug) {
      filtered = filtered.filter((e) =>
        e.categories.some((ec) => ec.category.slug === categorySlug),
      );
    }
    if (from) {
      filtered = filtered.filter((e) => new Date(e.startsAt) >= from);
    }
    if (to) {
      filtered = filtered.filter((e) => new Date(e.startsAt) <= to);
    }
    const sliced = filtered.slice(offset);
    for (const e of sliced) {
      eventItems.push({ type: 'EVENT', item: e });
    }
  }

  // Interleave: communities first, then events
  const merged: SearchResultRow[] = [...communityItems, ...eventItems];
  const hasMore = merged.length > limit;
  const items = merged.slice(0, limit);

  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit), 'utf8').toString('base64url')
    : undefined;

  return { items, nextCursor };
}
