import { db, resolveCityIds } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { subDays } from 'date-fns';
import { unstable_cache } from 'next/cache';
import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

const RECENTLY_ADDED_WINDOW_DAYS = 14;

function addIsRecentlyAdded<T extends { createdAt: Date }>(
  row: T,
): T & { isRecentlyAdded: boolean } {
  return {
    ...row,
    isRecentlyAdded: row.createdAt >= subDays(new Date(), RECENTLY_ADDED_WINDOW_DAYS),
  };
}

export type SearchResultRow =
  | { type: 'COMMUNITY'; item: CommunityListItem & { _count: { events: number } } }
  | { type: 'EVENT'; item: EventListItem }
  | { type: 'RESOURCE'; item: ResourceSearchItem };

/** Lightweight resource shape for unified search results (PRD/TDD-0048). */
export interface ResourceSearchItem {
  id: string;
  title: string;
  slug: string;
  resourceType: string;
  url: string | null;
  description: string | null;
  isEssential: boolean;
  createdAt: Date;
  city: { name: string; slug: string } | null;
}

export interface SearchAllOptions {
  q: string;
  /** Optional city slug. When omitted/empty, search runs across all of Germany. */
  citySlug?: string;
  categorySlug?: string;
  from?: Date;
  to?: Date;
  type?: 'COMMUNITY' | 'EVENT' | 'RESOURCE' | 'ALL';
  limit?: number;
  /** Opaque offset cursor - base64-encoded integer offset. */
  cursor?: string;
}

export interface SearchAllResult {
  items: SearchResultRow[];
  nextCursor?: string;
}

/**
 * Search communities by text query.
 *
 * When `citySlug` is provided, results are scoped to that city (+ satellites);
 * when omitted/empty, the search spans all of Germany (ADR-0010). Uses
 * PostgreSQL full-text search with a blended ranking that boosts higher-trust
 * and more-active communities, falling back to ILIKE for partial matches.
 */
export async function searchCommunities(
  citySlug: string | undefined,
  query: string,
  limit = 10,
): Promise<CommunityListItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  let cityIds: string[] = [];
  if (citySlug) {
    cityIds = await resolveCityIds(citySlug);
    if (cityIds.length === 0) return [];
  }

  const cityFilter =
    cityIds.length > 0 ? Prisma.sql`city_id IN (${Prisma.join(cityIds)}) AND` : Prisma.empty;

  // PostgreSQL full-text search with blended ranking: text relevance boosted by
  // trust + activity so quality supply surfaces above bare keyword matches.
  const rankedIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM communities
    WHERE ${cityFilter}
      status != 'INACTIVE'
      AND to_tsvector('english', name || ' ' || COALESCE(description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', name || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', ${trimmed})
    ) * (1 + (COALESCE(trust_score, 0) / 100.0) + (COALESCE(activity_score, 0) / 200.0)) DESC
    LIMIT ${limit}
  `;

  let ids = rankedIds.map((r) => r.id);

  // Fallback to ILIKE for partial matches that FTS misses (e.g. "yoga" matching "yogalife")
  if (ids.length === 0) {
    const fallback = await db.community.findMany({
      where: {
        ...(cityIds.length > 0 && { cityId: { in: cityIds } }),
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
      createdAt: true,
      languages: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
  });

  // Preserve rank order from full-text search
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  return results
    .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
    .map(addIsRecentlyAdded);
}

/**
 * Search events by text query.
 *
 * Scoped to a city when `citySlug` is given, national otherwise (ADR-0010).
 * Uses PostgreSQL full-text search with a recency-aware blend (sooner events
 * rank higher) and falls back to ILIKE.
 */
export async function searchEvents(
  citySlug: string | undefined,
  query: string,
  limit = 10,
): Promise<EventListItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  let cityIds: string[] = [];
  if (citySlug) {
    cityIds = await resolveCityIds(citySlug);
    if (cityIds.length === 0) return [];
  }

  const now = new Date();
  const cityFilter =
    cityIds.length > 0 ? Prisma.sql`city_id IN (${Prisma.join(cityIds)}) AND` : Prisma.empty;

  // PostgreSQL full-text search with a recency boost: among similarly relevant
  // matches, events happening sooner rank higher.
  const rankedIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM events
    WHERE ${cityFilter}
      starts_at >= ${now}
      AND status != 'CANCELLED'
      AND to_tsvector('english', title || ' ' || COALESCE(description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', ${trimmed})
    ) * (1 + 1.0 / (1 + GREATEST(EXTRACT(EPOCH FROM (starts_at - ${now})) / 86400.0, 0))) DESC
    LIMIT ${limit}
  `;

  let ids = rankedIds.map((r) => r.id);

  // Fallback to ILIKE for partial matches
  if (ids.length === 0) {
    const fallback = await db.event.findMany({
      where: {
        ...(cityIds.length > 0 && { cityId: { in: cityIds } }),
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
 * Search resources (evergreen guides / official links) by text query.
 *
 * Resources are mostly scope-based (national/state guides), so search always
 * spans national + global rows; when a `citySlug` is provided, city-scoped
 * rows for that city are also included. Essential resources get a ranking
 * boost (ADR-0010 blended ranking). Hidden/expired rows are excluded.
 */
export async function searchResources(
  citySlug: string | undefined,
  query: string,
  limit = 10,
): Promise<ResourceSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  let cityIds: string[] = [];
  if (citySlug) {
    cityIds = await resolveCityIds(citySlug);
  }

  // Include national/global resources plus rows that match the city's
  // resolved scope (city, metro, state). When `cityIds` is empty we skip
  // the filter to preserve previous behavior.
  let cityFilter: Prisma.Sql = Prisma.empty;
  let cityMeta: {
    slug: string;
    state: string;
    metroSlug?: string | null;
    satelliteSlugs: string[];
  } | null = null;
  if (cityIds.length > 0) {
    const city = await db.city.findUnique({
      where: { slug: citySlug! },
      select: {
        slug: true,
        state: true,
        metroRegion: { select: { slug: true } },
        satelliteCities: { select: { slug: true } },
      },
    });
    if (city) {
      cityMeta = {
        slug: city.slug,
        state: city.state,
        metroSlug: city.metroRegion?.slug ?? null,
        satelliteSlugs: city.satelliteCities.map((s) => s.slug),
      };

      const metroCandidates = [cityMeta.metroSlug, cityMeta.slug].filter(Boolean) as string[];
      const cityScopeSlugs = [cityMeta.slug, ...cityMeta.satelliteSlugs];

      const globalClause = Prisma.sql`(scope IN ('GLOBAL','COUNTRY'))`;
      const stateClause = Prisma.sql`(scope = 'STATE' AND scope_region = ${cityMeta.state})`;
      const metroClause = metroCandidates.length
        ? Prisma.sql`(scope = 'METRO' AND scope_region IN (${Prisma.join(metroCandidates)}))`
        : Prisma.empty;
      const cityClause = Prisma.sql`(scope = 'CITY' AND scope_region IN (${Prisma.join(cityScopeSlugs)}))`;

      cityFilter = Prisma.sql`
        (
          city_id IN (${Prisma.join(cityIds)})
          OR (
            city_id IS NULL
            AND (
              ${globalClause}
              OR ${stateClause}
              OR ${metroClause}
              OR ${cityClause}
            )
          )
        ) AND`;
    }
  }
  const now = new Date();

  const rankedIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM resources
    WHERE ${cityFilter}
      is_hidden = false
      AND (valid_until IS NULL OR valid_until >= ${now})
      AND to_tsvector('english', title || ' ' || COALESCE(description, ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', ${trimmed})
    ) * (CASE WHEN is_essential THEN 1.5 ELSE 1 END) DESC
    LIMIT ${limit}
  `;

  let ids = rankedIds.map((r) => r.id);

  // Fallback to ILIKE for partial matches
  if (ids.length === 0) {
    const where: any = {
      isHidden: false,
      OR: [
        { title: { contains: trimmed, mode: 'insensitive' } },
        { description: { contains: trimmed, mode: 'insensitive' } },
      ],
    };

    if (cityIds.length > 0 && cityMeta) {
      const metroCandidates = [cityMeta.metroSlug, cityMeta.slug].filter(Boolean) as string[];
      const cityScopeSlugs = [cityMeta.slug, ...cityMeta.satelliteSlugs];

      where.AND = [
        {
          OR: [
            { cityId: { in: cityIds } },
            {
              AND: [
                { cityId: null },
                {
                  OR: [
                    { scope: 'GLOBAL' },
                    { scope: 'COUNTRY' },
                    { AND: [{ scope: 'STATE' }, { scopeRegion: cityMeta.state }] },
                    ...(metroCandidates.length
                      ? [{ AND: [{ scope: 'METRO' }, { scopeRegion: { in: metroCandidates } }] }]
                      : []),
                    { AND: [{ scope: 'CITY' }, { scopeRegion: { in: cityScopeSlugs } }] },
                  ],
                },
              ],
            },
          ],
        },
      ];
    } else if (cityIds.length > 0) {
      // No city metadata found — fall back to previous behavior
      where.OR = [{ cityId: null }, { cityId: { in: cityIds } }];
    }

    const fallback = await db.resource.findMany({
      where,
      select: { id: true },
      orderBy: [{ isEssential: 'desc' }, { priority: 'desc' }],
      take: limit,
    });
    ids = fallback.map((r) => r.id);
  }

  if (ids.length === 0) return [];

  const results = await db.resource.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      slug: true,
      resourceType: true,
      url: true,
      description: true,
      isEssential: true,
      createdAt: true,
      city: { select: { name: true, slug: true } },
    },
  });

  const idOrder = new Map(ids.map((id, i) => [id, i]));
  return results
    .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
    .map((r) => ({ ...r, resourceType: String(r.resourceType) }));
}

/**
 * Return autocomplete suggestions for a partial query.
 * Combines approved keywords and matching community/event names.
 */
export async function getSuggestions(
  q: string,
  citySlug?: string,
  limit = 8,
): Promise<Array<{ text: string; type: 'COMMUNITY' | 'EVENT' | 'ALL'; slug?: string }>> {
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

  const results: Array<{ text: string; type: 'COMMUNITY' | 'EVENT' | 'ALL'; slug?: string }> =
    keywords.map((k) => ({ text: k.keyword, type: 'ALL' }));

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
    select: { name: true, slug: true },
  });
  for (const c of communities) {
    if (!keywordSet.has(c.name.toLowerCase())) {
      results.push({ text: c.name, type: 'COMMUNITY', slug: c.slug });
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
    select: { title: true, slug: true },
  });
  for (const e of events) {
    if (!keywordSet.has(e.title.toLowerCase())) {
      results.push({ text: e.title, type: 'EVENT', slug: e.slug });
    }
  }

  return results.slice(0, limit);
}

/**
 * Return trending search terms - approved keywords ordered by confidence.
 *
 * Cached for 60s with tag-based invalidation.
 */
export const getTrendingKeywords = unstable_cache(
  async (citySlug?: string, limit = 10): Promise<string[]> => _getTrendingKeywords(citySlug, limit),
  ['trending-keywords'],
  { revalidate: 60, tags: ['trending', 'trending-keywords'] },
);

async function _getTrendingKeywords(citySlug?: string, limit = 10): Promise<string[]> {
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
 * Combined full-text search across communities, events and resources.
 * When `citySlug` is omitted/empty the search spans all of Germany (ADR-0010).
 * Results are grouped: communities first, then events, then resources.
 * Cursor is a base64-encoded offset integer for simple pagination.
 */
export async function searchAll(opts: SearchAllOptions): Promise<SearchAllResult> {
  const { q, citySlug, categorySlug, from, to, type = 'ALL', limit = 20, cursor } = opts;

  const offset = cursor ? parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10) : 0;
  const fetchLimit = limit + 1; // fetch one extra to detect hasMore

  const communityItems: SearchResultRow[] = [];
  const eventItems: SearchResultRow[] = [];
  const resourceItems: SearchResultRow[] = [];

  if (type === 'COMMUNITY' || type === 'ALL') {
    const communities = await searchCommunities(citySlug, q, fetchLimit + offset);
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
    const events = await searchEvents(citySlug, q, fetchLimit + offset);
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

  // Resources are not category-filtered (they use audiences/lifecycle, not
  // community categories) and are skipped when a category facet is active.
  if ((type === 'RESOURCE' || type === 'ALL') && !categorySlug) {
    const resources = await searchResources(citySlug, q, fetchLimit + offset);
    const sliced = resources.slice(offset);
    for (const r of sliced) {
      resourceItems.push({ type: 'RESOURCE', item: r });
    }
  }

  // Group: communities first, then events, then resources
  const merged: SearchResultRow[] = [...communityItems, ...eventItems, ...resourceItems];
  const hasMore = merged.length > limit;
  const items = merged.slice(0, limit);

  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit), 'utf8').toString('base64url')
    : undefined;

  return { items, nextCursor };
}
