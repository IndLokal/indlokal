/**
 * Runtime pipeline source configuration.
 *
 * Single source of truth for keywords, regions, and strategies:
 *
 *   1. The DB table `pipeline_source_configs` (managed via
 *      `pnpm pipeline:sources:sync`, which upserts from JSON), OR
 *   2. The bundled JSON defaults at
 *      `apps/web/prisma/data/pipeline-source-defaults.json` (fallback
 *      when the table is missing or empty - keeps fresh deployments and
 *      test environments working without a manual sync step).
 *
 * The DB row is always preferred when present, so admins can disable or
 * tweak entries without redeploying. The bundled JSON is the canonical
 * baseline that bootstrap seeds and that runtime falls back to.
 *
 * All four getters share a single per-process read of the underlying
 * config rows so a pipeline run never hits the DB more than once for
 * planning data.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, type PipelineSourceType } from '@prisma/client';
import { db } from '@/lib/db';
import { assessEvidenceUrl } from '@/lib/source-policy';
import { ACTIVE_CITY_DATA, SATELLITE_CITY_DATA, UPCOMING_CITIES } from '@/lib/config/cities';
import type { SearchRegion, SearchStrategy, SourceType, SourceLane, SourceIntent } from './types';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };
export type KeywordStrategyTemplate = Omit<KeywordStrategy, 'keywords'>;
export type JourneyResourceStage =
  | 'PRE_ARRIVAL'
  | 'FIRST_30_DAYS'
  | 'FIRST_90_DAYS'
  | 'SETTLED'
  | 'ANYTIME';

export type RuntimeLaneKeywordSeeds = {
  byLane: Partial<Record<SourceLane, string[]>>;
  journeyResourceByStage: Partial<Record<JourneyResourceStage, string[]>>;
};

type ConfigRow = {
  configType: 'REGION' | 'STRATEGY' | 'KEYWORD';
  key: string;
  label: string;
  enabled: boolean;
  sourceType: PipelineSourceType | null;
  kind: string | null;
  payload: unknown;
};

type ConfigSource = 'db' | 'json-fallback';
type PinnedScope = 'GENERIC' | 'CITY' | 'REGION';

const VALID_SOURCE_TYPES = new Set<SourceType>([
  'EVENTBRITE',
  'FACEBOOK',
  'INSTAGRAM',
  'WEBSITE_SCRAPE',
  'CGI_MUNICH',
  'INDOEUROPEAN',
  'GOOGLE_ALERT',
  'GOOGLE_SEARCH',
  'DUCKDUCKGO',
  'MEETUP',
  'COMMUNITY_SUGGESTION',
  'DB_COMMUNITY',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );
}

function normalizeSourceType(value: PipelineSourceType | string | null): SourceType | null {
  if (!value) return null;
  return VALID_SOURCE_TYPES.has(value as SourceType) ? (value as SourceType) : null;
}

function normalizePinnedScope(value: unknown): PinnedScope | null {
  if (typeof value !== 'string') return null;
  if (value === 'GENERIC' || value === 'CITY' || value === 'REGION') return value;
  return null;
}

// ── Lane helpers ────────────────────────────────────────────────────

const VALID_LANES = new Set<SourceLane>(['EVENT', 'COMMUNITY', 'RESOURCE']);

function normalizeSourceLane(value: unknown): SourceLane | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.trim().toUpperCase() as SourceLane;
  return VALID_LANES.has(upper) ? upper : undefined;
}

/**
 * Conservative lane inference for source types with built-in content intent.
 * Returns undefined for ambiguous types (GOOGLE_SEARCH, WEBSITE_SCRAPE, etc.) that
 * must carry an explicit lane annotation in config payloads.
 *
 * Unambiguous inference:
 *   - EVENTBRITE, MEETUP → EVENT
 *   - DB_COMMUNITY → EVENT
 *   - CGI_MUNICH → RESOURCE
 *   - COMMUNITY_SUGGESTION → COMMUNITY
 */
function inferLaneFromSourceType(sourceType: SourceType): SourceLane | undefined {
  switch (sourceType) {
    case 'EVENTBRITE':
    case 'MEETUP':
    case 'DB_COMMUNITY':
      return 'EVENT';
    case 'CGI_MUNICH':
      return 'RESOURCE';
    case 'COMMUNITY_SUGGESTION':
      return 'COMMUNITY';
    default:
      // GOOGLE_SEARCH, DUCKDUCKGO, WEBSITE_SCRAPE, FACEBOOK, INSTAGRAM,
      // INDOEUROPEAN, GOOGLE_ALERT — require explicit lane in config payload.
      return undefined;
  }
}

/**
 * Derive pipeline source intent from lane and content scope metadata.
 * SourceIntent shapes LLM extraction instructions and filtering behavior.
 *
 * Examples:
 *   - EVENT lane → 'dated_activity_discovery'
 *   - COMMUNITY lane → 'org_group_discovery'
 *   - RESOURCE lane → 'official_service_info_discovery'
 *   - scope 'official_portal' → 'official_service_info_discovery'
 */
function deriveSourceIntent(
  lane: SourceLane | undefined,
  contentScope: unknown,
): SourceIntent | undefined {
  if (typeof contentScope === 'string') {
    if (contentScope === 'official_portal') return 'official_service_info_discovery';
    if (contentScope === 'community_events' || contentScope === 'official_events') {
      return 'dated_activity_discovery';
    }
    if (
      contentScope === 'keyword_discovery' ||
      contentScope === 'directory_listing' ||
      contentScope === 'community_portal'
    ) {
      return 'org_group_discovery';
    }
  }

  if (lane === 'EVENT') return 'dated_activity_discovery';
  if (lane === 'COMMUNITY') return 'org_group_discovery';
  if (lane === 'RESOURCE') return 'official_service_info_discovery';
  return undefined;
}

/**
 * Read source configuration from the database table `pipeline_source_configs`.
 * Used as the primary config source when available and populated.
 * Ordered by config type and key for consistent output.
 */
async function readConfigRowsFromDb(): Promise<ConfigRow[]> {
  return db.$queryRaw<ConfigRow[]>(Prisma.sql`
    SELECT
      config_type as "configType",
      key,
      label,
      enabled,
      source_type as "sourceType",
      kind,
      payload
    FROM pipeline_source_configs
    ORDER BY config_type ASC, key ASC
  `);
}

// ── JSON fallback ──────────────────────────────────────
// Mirrors the bootstrap loader in apps/web/prisma/pipeline-source-config.ts
// but applies only the lightweight checks runtime needs (full validation
// stays in the bootstrap script so bad data fails the seed, not requests).

/**
 * Load source config from the bundled JSON fallback file at
 * `apps/web/prisma/data/pipeline-source-defaults.json`.
 *
 * Fallback behavior:
 *   - Used when DB table is missing or empty (fresh deployments, test environments)
 *   - Applies lightweight validation only (full validation is in the bootstrap seeder)
 *   - Keeps the system functional without manual seed/migration steps
 *
 * Format: { baselineKeywords, regions, strategies, journeyKeywordHintsByLane }
 */
type JsonRegion = {
  id?: unknown;
  label?: unknown;
  searchCenter?: unknown;
  state?: unknown;
  enabled?: unknown;
};

type JsonStrategy = {
  id?: unknown;
  sourceType?: unknown;
  kind?: unknown;
  label?: unknown;
  enabled?: unknown;
  radiusKm?: unknown;
  url?: unknown;
  hintCitySlug?: unknown;
  hintState?: unknown;
  scope?: unknown;
  lane?: unknown;
};

type JsonDefaults = {
  baselineKeywords?: unknown;
  baselineKeywordsByLane?: unknown;
  journeyKeywordHintsByLane?: unknown;
  regions?: unknown;
  strategies?: unknown;
};

function normalizeJourneyStage(value: unknown): JourneyResourceStage | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.trim().toUpperCase();
  switch (upper) {
    case 'PRE_ARRIVAL':
    case 'FIRST_30_DAYS':
    case 'FIRST_90_DAYS':
    case 'SETTLED':
    case 'ANYTIME':
      return upper;
    default:
      return undefined;
  }
}

function parseLaneKeywordSeeds(parsed: JsonDefaults): RuntimeLaneKeywordSeeds {
  const byLane: Partial<Record<SourceLane, string[]>> = {};
  const journeyResourceByStage: Partial<Record<JourneyResourceStage, string[]>> = {};

  if (isObject(parsed.baselineKeywordsByLane)) {
    for (const lane of ['EVENT', 'COMMUNITY', 'RESOURCE'] as const) {
      byLane[lane] = normalizeStringArray(parsed.baselineKeywordsByLane[lane]);
    }
  }

  if (
    isObject(parsed.journeyKeywordHintsByLane) &&
    isObject(parsed.journeyKeywordHintsByLane.RESOURCE)
  ) {
    for (const [rawStage, value] of Object.entries(parsed.journeyKeywordHintsByLane.RESOURCE)) {
      const stage = normalizeJourneyStage(rawStage);
      if (!stage) continue;
      journeyResourceByStage[stage] = normalizeStringArray(value);
    }
  }

  return { byLane, journeyResourceByStage };
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveDefaultsJsonPath(): string {
  // runtime-config.ts lives in `apps/web/src/modules/pipeline/`.
  // The bundled defaults live in `apps/web/prisma/data/`.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '../../../prisma/data/pipeline-source-defaults.json');
}

/**
 * Derive city slugs for a region by state name.
 * Mirrors the bootstrap logic so runtime fallback matches DB-seeded values.
 * Includes ACTIVE_CITY_DATA, SATELLITE_CITY_DATA (satellites for metros), and UPCOMING_CITIES.
 */
function getCitySlugsForState(state: string): string[] {
  const slugs: string[] = [];
  const metroSlugsForState = new Set<string>();

  for (const city of ACTIVE_CITY_DATA) {
    if (city.state === state) {
      slugs.push(city.slug);
      metroSlugsForState.add(city.slug);
    }
  }

  for (const city of SATELLITE_CITY_DATA) {
    const isInState = city.state === state;
    const isMetroSatellite = Boolean(city.metroSlug && metroSlugsForState.has(city.metroSlug));
    if (isInState || isMetroSatellite) slugs.push(city.slug);
  }

  for (const city of UPCOMING_CITIES) if (city.state === state) slugs.push(city.slug);
  return Array.from(new Set(slugs));
}

async function readConfigRowsFromJson(): Promise<ConfigRow[]> {
  const raw = await readFile(resolveDefaultsJsonPath(), 'utf8');
  const parsed = JSON.parse(raw) as JsonDefaults;

  const rows: ConfigRow[] = [];

  const baselineKeywords = normalizeStringArray(parsed.baselineKeywords);
  for (const keyword of baselineKeywords) {
    rows.push({
      configType: 'KEYWORD',
      key: normalizeKeyword(keyword),
      label: keyword,
      enabled: true,
      sourceType: null,
      kind: null,
      payload: { origin: 'json-fallback' },
    });
  }

  const regionsRaw = Array.isArray(parsed.regions) ? (parsed.regions as JsonRegion[]) : [];
  for (const region of regionsRaw) {
    if (!isObject(region)) continue;
    if (region.enabled === false) continue;
    const id = typeof region.id === 'string' ? region.id : '';
    const label = typeof region.label === 'string' ? region.label : '';
    const searchCenter = typeof region.searchCenter === 'string' ? region.searchCenter : '';
    const state = typeof region.state === 'string' ? region.state : '';
    if (!id || !label || !searchCenter || !state) continue;

    const citySlugs = getCitySlugsForState(state);
    if (citySlugs.length === 0) continue;

    rows.push({
      configType: 'REGION',
      key: id,
      label,
      enabled: true,
      sourceType: null,
      kind: null,
      payload: {
        searchCenter,
        state,
        citySlugs,
      },
    });
  }

  const strategiesRaw = Array.isArray(parsed.strategies)
    ? (parsed.strategies as JsonStrategy[])
    : [];
  for (const strategy of strategiesRaw) {
    if (!isObject(strategy)) continue;
    if (strategy.enabled === false) continue;
    const id = typeof strategy.id === 'string' ? strategy.id : '';
    const label = typeof strategy.label === 'string' ? strategy.label : '';
    const sourceType = typeof strategy.sourceType === 'string' ? strategy.sourceType : '';
    const kind = strategy.kind;
    if (!id || !label || !sourceType) continue;
    if (kind !== 'keyword_search' && kind !== 'pinned_url') continue;

    const payload: Record<string, unknown> = {};
    if (kind === 'keyword_search') {
      const radius = typeof strategy.radiusKm === 'number' ? strategy.radiusKm : 50;
      payload.radiusKm = radius > 0 ? radius : 50;
    } else {
      if (typeof strategy.url !== 'string') continue;
      payload.url = strategy.url;
      if (typeof strategy.hintCitySlug === 'string' && strategy.hintCitySlug.trim().length > 0) {
        payload.hintCitySlug = strategy.hintCitySlug.trim();
      }
      if (typeof strategy.hintState === 'string' && strategy.hintState.trim().length > 0) {
        payload.hintState = strategy.hintState.trim();
      }
      const scope = normalizePinnedScope(strategy.scope);
      if (scope) payload.scope = scope;
    }

    // Carry explicit lane from config; falls back to sourceType inference at
    // parse time (normalizeSourceLane / inferLaneFromSourceType).
    if (typeof strategy.lane === 'string' && strategy.lane.trim().length > 0) {
      payload.lane = strategy.lane.trim().toUpperCase();
    }

    rows.push({
      configType: 'STRATEGY',
      key: id,
      label,
      enabled: true,
      sourceType: sourceType as PipelineSourceType,
      kind,
      payload,
    });
  }

  return rows;
}

// ── Cached loader ──────────────────────────────────────
// In-process cache ensures each request loads config only once.
// Prevents repeated DB queries or file I/O during a single pipeline run.
// Can be reset for tests or long-running workers.

let cachedRows: { rows: ConfigRow[]; source: ConfigSource } | null = null;
let inflight: Promise<{ rows: ConfigRow[]; source: ConfigSource }> | null = null;

/**
 * Load config rows from DB or JSON fallback, with single-process caching.
 * Tries DB first; if empty or unavailable, falls back to bundled JSON and logs a warning.
 * Concurrent callers share the same inflight promise.
 */
async function loadConfigRows(): Promise<{ rows: ConfigRow[]; source: ConfigSource }> {
  if (cachedRows) return cachedRows;
  if (inflight) return inflight;

  inflight = (async () => {
    let dbError: unknown = null;
    let dbRows: ConfigRow[] = [];
    try {
      dbRows = await readConfigRowsFromDb();
    } catch (error) {
      dbError = error;
    }

    if (dbRows.length > 0) {
      return { rows: dbRows, source: 'db' as const };
    }

    if (dbError) {
      console.warn(
        `[Pipeline] pipeline_source_configs unavailable, falling back to bundled defaults. Apply the migration and run pnpm pipeline:sources:sync to enable DB-managed config. Cause: ${String(
          dbError,
        )}`,
      );
    } else {
      console.warn(
        '[Pipeline] pipeline_source_configs is empty; using bundled defaults. Run pnpm pipeline:sources:sync to seed the table.',
      );
    }

    const jsonRows = await readConfigRowsFromJson();
    return { rows: jsonRows, source: 'json-fallback' as const };
  })();

  try {
    cachedRows = await inflight;
    return cachedRows;
  } finally {
    inflight = null;
  }
}

/**
 * Clear the in-process config cache. Intended for tests and long-lived worker processes.
 * Forces the next config getter to reload from DB or JSON.
 */
export function resetRuntimeConfigCache(): void {
  cachedRows = null;
  inflight = null;
}

// ── Parsers (operate on either source) ────────────────

/**
 * Parse regions from config rows into SearchRegion contracts.
 * Filters disabled rows and validates required fields (searchCenter, citySlugs).
 */
function parseRegions(rows: ConfigRow[]): SearchRegion[] {
  const regions: SearchRegion[] = [];
  for (const row of rows) {
    if (row.configType !== 'REGION' || !row.enabled) continue;
    if (!isObject(row.payload)) continue;

    const searchCenter =
      typeof row.payload.searchCenter === 'string' ? row.payload.searchCenter.trim() : '';
    const citySlugs = normalizeStringArray(row.payload.citySlugs);
    if (!searchCenter || citySlugs.length === 0) continue;

    regions.push({
      id: row.key,
      label: row.label,
      searchCenter,
      state: typeof row.payload.state === 'string' ? row.payload.state.trim() : undefined,
      citySlugs,
      enabled: true,
    });
  }

  return regions;
}

/**
 * Parse keyword strategy templates from config rows.
 * Normalizes source types, radius, lane, and source intent.
 * Skips disabled rows and entries without required fields.
 */
function parseKeywordStrategies(rows: ConfigRow[]): KeywordStrategyTemplate[] {
  const strategies: KeywordStrategyTemplate[] = [];

  for (const row of rows) {
    if (row.configType !== 'STRATEGY' || !row.enabled || row.kind !== 'keyword_search') continue;
    const sourceType = normalizeSourceType(row.sourceType);
    if (!sourceType) continue;
    if (!isObject(row.payload)) continue;

    const radiusRaw = row.payload.radiusKm;
    const radiusKm =
      typeof radiusRaw === 'number' && Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 50;

    const lane = normalizeSourceLane(row.payload.lane) ?? inferLaneFromSourceType(sourceType);
    const sourceIntent = deriveSourceIntent(lane, row.payload.contentScope);
    strategies.push({
      id: row.key,
      sourceType,
      kind: 'keyword_search',
      label: row.label,
      radiusKm,
      enabled: true,
      lane,
      sourceIntent,
    });
  }

  return strategies;
}

/**
 * Extract baseline keyword seeds from config rows.
 * These are shared keywords used across multiple strategies as semantic anchors.
 */
function parseKeywordSeeds(rows: ConfigRow[]): string[] {
  return rows
    .filter((row) => row.configType === 'KEYWORD' && row.enabled)
    .map((row) => row.label.trim())
    .filter(Boolean);
}

/**
 * Parse pinned URL strategies from config rows.
 * Validates URL presence, scope, and lane metadata.
 * Skips disabled rows and entries without required fields.
 */
function parsePinnedStrategies(rows: ConfigRow[]): PinnedStrategy[] {
  const strategies: PinnedStrategy[] = [];

  for (const row of rows) {
    if (row.configType !== 'STRATEGY' || !row.enabled || row.kind !== 'pinned_url') continue;
    const sourceType = normalizeSourceType(row.sourceType);
    if (!sourceType) continue;
    if (!isObject(row.payload)) continue;

    const url = typeof row.payload.url === 'string' ? row.payload.url.trim() : '';
    const hintCitySlug =
      typeof row.payload.hintCitySlug === 'string' ? row.payload.hintCitySlug.trim() : undefined;
    const hintState =
      typeof row.payload.hintState === 'string' ? row.payload.hintState.trim() : undefined;
    const parsedScope = normalizePinnedScope(row.payload.scope);
    const scope: PinnedScope =
      parsedScope ?? (hintCitySlug ? 'CITY' : hintState ? 'REGION' : 'GENERIC');
    if (!url) continue;

    const evidence = assessEvidenceUrl(url);
    if (!evidence.isQualifying) {
      console.warn(`[Pipeline] Disabled DB pinned URL ${row.key}: ${evidence.label} (${url})`);
      continue;
    }

    const lane = normalizeSourceLane(row.payload.lane) ?? inferLaneFromSourceType(sourceType);
    const sourceIntent = deriveSourceIntent(lane, row.payload.contentScope);
    strategies.push({
      id: row.key,
      sourceType,
      kind: 'pinned_url',
      label: row.label,
      url,
      scope,
      hintCitySlug: hintCitySlug || undefined,
      hintState: hintState || undefined,
      enabled: true,
      lane,
      sourceIntent,
    });
  }

  return strategies;
}

// ── Public API ─────────────────────────────────────────

/**
 * Fetch all enabled regions for the current pipeline context.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Used during source planning to scope keyword and pinned searches.
 */
/**
 * Fetch all enabled regions for the current pipeline context.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Used during source planning to scope keyword and pinned searches.
 */
export async function getRuntimeEnabledRegions(): Promise<SearchRegion[]> {
  const { rows } = await loadConfigRows();
  const parsed = parseRegions(rows);
  if (parsed.length === 0) {
    throw new Error(
      '[Pipeline] No enabled REGION rows in pipeline_source_configs and no fallback regions found in pipeline-source-defaults.json.',
    );
  }
  return parsed;
}

/**
 * Fetch all enabled keyword search strategies.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Includes lane metadata and source intent for lane-aware orchestration.
 */
/**
 * Fetch all enabled keyword search strategies.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Includes lane metadata and source intent for lane-aware orchestration.
 */
export async function getRuntimeKeywordStrategies(): Promise<KeywordStrategyTemplate[]> {
  const { rows } = await loadConfigRows();
  const parsed = parseKeywordStrategies(rows);
  if (parsed.length === 0) {
    throw new Error(
      '[Pipeline] No enabled keyword_search STRATEGY rows in pipeline_source_configs and no fallback found in pipeline-source-defaults.json.',
    );
  }
  return parsed;
}

/**
 * Fetch baseline keyword seeds used across multiple sources.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Serves as semantic anchors for gap analysis and strategy planning.
 */
/**
 * Fetch baseline keyword seeds used across multiple sources.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Serves as semantic anchors for gap analysis and strategy planning.
 */
export async function getRuntimeKeywordSeeds(): Promise<string[]> {
  const { rows } = await loadConfigRows();
  const parsed = parseKeywordSeeds(rows);
  if (parsed.length === 0) {
    throw new Error(
      '[Pipeline] No enabled KEYWORD rows in pipeline_source_configs and no fallback baselineKeywords found in pipeline-source-defaults.json.',
    );
  }
  return parsed;
}

/**
 * Additional lane-aware keyword hints from the bundled JSON defaults.
 * These are additive planning hints used by source-plan and remain
 * backward compatible with DB-managed KEYWORD rows.
 */
/**
 * Fetch lane-specific keyword seeds and journey resource stage hints.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Used for lane-aware keyword expansion and RESOURCE discovery by lifecycle stage.
 */
/**
 * Fetch lane-specific keyword seeds and journey resource stage hints.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Used for lane-aware keyword expansion and RESOURCE discovery by lifecycle stage.
 */
export async function getRuntimeLaneKeywordSeeds(): Promise<RuntimeLaneKeywordSeeds> {
  const raw = await readFile(resolveDefaultsJsonPath(), 'utf8');
  const parsed = JSON.parse(raw) as JsonDefaults;
  return parseLaneKeywordSeeds(parsed);
}

/**
 * Fetch all enabled pinned URL strategies.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Includes lane metadata and hints for city/origin bucketing during execution.
 */
/**
 * Fetch all enabled pinned URL strategies.
 * Cached per-process; clears only on resetRuntimeConfigCache().
 * Includes lane metadata and hints for city/origin bucketing during execution.
 */
export async function getRuntimePinnedStrategies(): Promise<PinnedStrategy[]> {
  const { rows } = await loadConfigRows();
  const parsed = parsePinnedStrategies(rows);
  if (parsed.length === 0) {
    throw new Error(
      '[Pipeline] No enabled pinned_url STRATEGY rows in pipeline_source_configs and no fallback found in pipeline-source-defaults.json.',
    );
  }
  return parsed;
}

/** Diagnostic: which source the runtime loader is currently serving from. */
/**
 * Report the current config source (DB or JSON fallback).
 * Useful for debugging and observability: determines whether config is DB-managed or using defaults.
 */
/**
 * Report the current config source (DB or JSON fallback).
 * Useful for debugging and observability: determines whether config is DB-managed or using defaults.
 */
export async function getRuntimeConfigSource(): Promise<ConfigSource> {
  const { source } = await loadConfigRows();
  return source;
}
