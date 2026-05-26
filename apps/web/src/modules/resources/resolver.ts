/**
 * Resource resolver - PRD/TDD-0030 §3.
 *
 * Given a city slug, returns every resource that applies to that city by
 * unioning rows across scope tiers:
 *
 *   CITY        - scopeRegion = city.slug
 *   METRO       - scopeRegion = city.metroRegion?.slug (or city.slug when
 *                 the city is itself a metro)
 *   STATE       - scopeRegion = city.state (Bundesland ISO, e.g. 'DE-BW')
 *   COUNTRY     - scopeRegion = 'DE'  (filtered through CONSULAR_JURISDICTION
 *                 for consular rows so a Berlin user only sees CGI Berlin)
 *   GLOBAL      - scopeRegion IS NULL
 *
 * Results are deduplicated by slug (the most specific scope wins) and tagged
 * with `resolvedScope` so the UI can group / label them.
 *
 * Caching: simple LRU per the TDD (60 s TTL, 500 entries). Bust via
 * `invalidateResolver()` on admin save.
 */

import { db } from '@/lib/db';
import type {
  Prisma,
  ResourceType,
  ResourceScope,
  ResourceAudience,
  ResourceStage,
} from '@prisma/client';

// ── Consular jurisdiction map ────────────────────────────────────────────
//
// Indian government has three diplomatic posts in Germany. Each city maps
// to exactly one. Resources with metadata.consulate=X are only surfaced for
// cities mapped to X. Resources without a consulate tag fall through.
//
//  - Embassy of India, Berlin     → BB, BE, BW (partly), HE (partly),
//                                    MV, NI, SN, ST, SH, TH
//  - CGI Frankfurt                → HE, NW, RP, SL
//  - CGI Munich                   → BY, BW (incl. Stuttgart/Karlsruhe/
//                                    Mannheim/Heidelberg)
//
// This is the high-level mapping. Keys are the canonical Bundesland names
// as stored on `city.state` (German names; the same values the cities
// bootstrap uses). We accept ISO codes (DE-XX) too for forward-compat.
const CONSULAR_JURISDICTION_BY_STATE: Record<string, 'berlin' | 'frankfurt' | 'munich'> = {
  // Embassy Berlin
  Berlin: 'berlin',
  Brandenburg: 'berlin',
  'Mecklenburg-Vorpommern': 'berlin',
  'Mecklenburg-Western Pomerania': 'berlin',
  Sachsen: 'berlin',
  Saxony: 'berlin',
  'Sachsen-Anhalt': 'berlin',
  'Saxony-Anhalt': 'berlin',
  Thüringen: 'berlin',
  Thuringia: 'berlin',
  Niedersachsen: 'berlin',
  'Lower Saxony': 'berlin',
  Bremen: 'berlin',
  'Schleswig-Holstein': 'berlin',
  Hamburg: 'berlin',
  // CGI Frankfurt
  Hessen: 'frankfurt',
  Hesse: 'frankfurt',
  'Nordrhein-Westfalen': 'frankfurt',
  'North Rhine-Westphalia': 'frankfurt',
  'Rheinland-Pfalz': 'frankfurt',
  'Rhineland-Palatinate': 'frankfurt',
  Saarland: 'frankfurt',
  // CGI Munich
  Bayern: 'munich',
  Bavaria: 'munich',
  'Baden-Württemberg': 'munich',
  'Baden-Wuerttemberg': 'munich',
  // ISO aliases (forward-compat)
  'DE-BE': 'berlin',
  'DE-BB': 'berlin',
  'DE-MV': 'berlin',
  'DE-SN': 'berlin',
  'DE-ST': 'berlin',
  'DE-TH': 'berlin',
  'DE-NI': 'berlin',
  'DE-HB': 'berlin',
  'DE-SH': 'berlin',
  'DE-HH': 'berlin',
  'DE-HE': 'frankfurt',
  'DE-NW': 'frankfurt',
  'DE-RP': 'frankfurt',
  'DE-SL': 'frankfurt',
  'DE-BY': 'munich',
  'DE-BW': 'munich',
};

export function consulateForState(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null;
  return CONSULAR_JURISDICTION_BY_STATE[stateCode] ?? null;
}

// ── Public types ─────────────────────────────────────────────────────────

export interface ResolvedResource {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  url: string | null;
  description: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  metadata: unknown;
  createdAt: Date;
  scope: ResourceScope;
  scopeRegion: string | null;
  audiences: ResourceAudience[];
  lifecycleStage: ResourceStage[];
  priority: number;
  isEssential: boolean;
  /** Which scope tier matched this resource for the requested city. */
  resolvedScope: ResourceScope;
}

export interface ResolverOptions {
  type?: ResourceType;
  audience?: ResourceAudience;
  stage?: ResourceStage;
  essentialsOnly?: boolean;
}

// ── LRU cache (60 s, 500 entries) ────────────────────────────────────────

interface CacheEntry {
  expiresAt: number;
  rows: ResolvedResource[];
}
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const resolverCache = new Map<string, CacheEntry>();

function cacheKey(citySlug: string, opts: ResolverOptions): string {
  return [
    citySlug,
    opts.type ?? '*',
    opts.audience ?? '*',
    opts.stage ?? '*',
    opts.essentialsOnly ? '!' : '-',
  ].join('|');
}

export function invalidateResolver(): void {
  resolverCache.clear();
}

// ── Scope-tier specificity for dedup-by-slug (higher = more specific) ───
const SCOPE_RANK: Record<ResourceScope, number> = {
  GLOBAL: 0,
  COUNTRY: 1,
  STATE: 2,
  METRO: 3,
  CITY: 4,
  DISTRICT: 5,
};

// ── Resolver ─────────────────────────────────────────────────────────────

export async function getResourcesForCity(
  citySlug: string,
  opts: ResolverOptions = {},
): Promise<ResolvedResource[]> {
  const key = cacheKey(citySlug, opts);
  const hit = resolverCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.rows;

  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: {
      id: true,
      slug: true,
      state: true,
      isMetroPrimary: true,
      metroRegion: { select: { slug: true } },
    },
  });
  if (!city) return [];

  const metroSlug = city.isMetroPrimary ? city.slug : (city.metroRegion?.slug ?? null);
  const consulate = consulateForState(city.state);

  // Build the OR clause across scope tiers. Note: the consular jurisdiction
  // filter is applied in JS post-query because Prisma's JSON path filter
  // can't cleanly express "key absent OR key equals X" in a single where.
  const scopeOr: Prisma.ResourceWhereInput[] = [
    { scope: 'GLOBAL' },
    { scope: 'COUNTRY' },
    { scope: 'STATE', scopeRegion: city.state ?? '__none__' },
    ...(metroSlug ? [{ scope: 'METRO' as const, scopeRegion: metroSlug }] : []),
    { scope: 'CITY', scopeRegion: city.slug },
    // Back-compat: legacy rows still keyed by cityId.
    { scope: 'CITY', cityId: city.id },
  ];

  const where: Prisma.ResourceWhereInput = {
    isHidden: false,
    AND: [
      { OR: scopeOr },
      ...(opts.type ? [{ resourceType: opts.type }] : []),
      ...(opts.audience ? [{ audiences: { has: opts.audience } }] : []),
      ...(opts.stage ? [{ lifecycleStage: { has: opts.stage } }] : []),
      ...(opts.essentialsOnly ? [{ isEssential: true }] : []),
    ],
  };

  const rows = await db.resource.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      resourceType: true,
      url: true,
      description: true,
      validFrom: true,
      validUntil: true,
      metadata: true,
      createdAt: true,
      scope: true,
      scopeRegion: true,
      audiences: true,
      lifecycleStage: true,
      priority: true,
      isEssential: true,
    },
    orderBy: [{ priority: 'desc' }, { title: 'asc' }],
  });

  // Dedup by slug - most specific scope wins.
  const bySlug = new Map<string, ResolvedResource>();
  for (const row of rows) {
    // Consular jurisdiction filter (TDD §3) - COUNTRY rows tagged with
    // metadata.consulate are only visible when the city's consulate
    // matches. Untagged COUNTRY rows are always visible.
    if (row.scope === 'COUNTRY') {
      const tag = (row.metadata as { consulate?: unknown } | null)?.consulate;
      if (typeof tag === 'string' && tag !== consulate) continue;
    }
    const candidate: ResolvedResource = { ...row, resolvedScope: row.scope };
    const existing = bySlug.get(row.slug);
    if (!existing || SCOPE_RANK[candidate.scope] > SCOPE_RANK[existing.scope]) {
      bySlug.set(row.slug, candidate);
    }
  }
  const deduped = [...bySlug.values()].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.title.localeCompare(b.title);
  });

  // Cache write with simple LRU eviction.
  if (resolverCache.size >= CACHE_MAX) {
    const oldestKey = resolverCache.keys().next().value;
    if (oldestKey) resolverCache.delete(oldestKey);
  }
  resolverCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, rows: deduped });

  return deduped;
}
