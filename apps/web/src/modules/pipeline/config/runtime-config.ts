/**
 * Runtime source configuration loader for pipeline planning.
 *
 * Configuration precedence:
 * 1) DB table pipeline_source_configs (primary)
 * 2) Bundled JSON defaults in prisma/data/pipeline-source-defaults.json (fallback)
 *
 * DB-backed rows are preferred when present so operators can adjust strategy
 * behavior without redeploying. The JSON file remains the bootstrap baseline
 * and runtime safety net for fresh/test environments.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PipelineSourceType, Prisma, ResourceStage } from '@prisma/client';
import { db } from '@/lib/db';
import { assessEvidenceUrl } from '@/lib/source-policy';
import { ACTIVE_CITY_DATA, SATELLITE_CITY_DATA, UPCOMING_CITIES } from '@/lib/config/cities';
import type { SearchRegion, SearchStrategy, SourceType, SourceLane, SourceIntent } from '../types';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };
export type KeywordStrategyTemplate = Omit<KeywordStrategy, 'keywords'>;

/** Canonical lane vocabulary used across runtime parsing and planner routing. */
export const SOURCE_LANES = ['EVENT', 'COMMUNITY', 'RESOURCE'] as const;

/** Canonical lifecycle stages for RESOURCE journey hints. */
export const JOURNEY_RESOURCE_STAGES: readonly ResourceStage[] = Object.values(ResourceStage);

export type JourneyResourceStage = ResourceStage;

/** Lane-specific keyword seed payload used by source planning. */
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

const UNSUPPORTED_PIPELINE_SOURCE_TYPES = new Set<PipelineSourceType>([
  PipelineSourceType.EVENT_SUGGESTION,
  PipelineSourceType.USER_SUBMITTED,
]);

const VALID_SOURCE_TYPES = new Set<SourceType>(
  Object.values(PipelineSourceType).filter(
    (sourceType): sourceType is SourceType => !UNSUPPORTED_PIPELINE_SOURCE_TYPES.has(sourceType),
  ),
);

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

/** Normalization sets for lane and journey stage parsing. */

const VALID_LANES = new Set<SourceLane>(SOURCE_LANES);
const VALID_JOURNEY_STAGES = new Set<JourneyResourceStage>(JOURNEY_RESOURCE_STAGES);

function normalizeSourceLane(value: unknown): SourceLane | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.trim().toUpperCase() as SourceLane;
  return VALID_LANES.has(upper) ? upper : undefined;
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
 * Format: { regions, strategies, baselineKeywordsByLane, journeyKeywordHintsByLane }
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
  baselineKeywordsByLane?: unknown;
  journeyKeywordHintsByLane?: unknown;
  regions?: unknown;
  strategies?: unknown;
};

function normalizeJourneyStage(value: unknown): JourneyResourceStage | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.trim().toUpperCase() as JourneyResourceStage;
  return VALID_JOURNEY_STAGES.has(upper) ? upper : undefined;
}

/** Parse lane-seeded keyword hints from JSON defaults. */
function parseLaneKeywordSeeds(parsed: JsonDefaults): RuntimeLaneKeywordSeeds {
  const byLane: Partial<Record<SourceLane, string[]>> = {};
  const journeyResourceByStage: Partial<Record<JourneyResourceStage, string[]>> = {};

  if (isObject(parsed.baselineKeywordsByLane)) {
    for (const lane of SOURCE_LANES) {
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

function resolveDefaultsJsonPath(): string {
  // runtime-config.ts lives in apps/web/src/modules/pipeline/config/.
  // The bundled defaults live in apps/web/prisma/data/.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '../../../../prisma/data/pipeline-source-defaults.json');
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

    // Carry explicit lane from config. Fresh configs must declare lane directly.
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

/**
 * In-process cache for parsed config rows.
 * Prevents repeated DB/file reads during a planner execution window.
 */

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

/** Parsers operate uniformly on rows from DB or JSON fallback. */

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

    const lane = normalizeSourceLane(row.payload.lane);
    if (!lane) continue;
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
 * Parse pinned URL strategies from config rows.
 * Validates URL presence, scope, lane metadata, and source-policy qualification.
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

    const lane = normalizeSourceLane(row.payload.lane);
    if (!lane) continue;
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
 * Throws when neither DB nor JSON fallback yields any enabled regions.
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
 * Throws when neither DB nor JSON fallback yields any keyword strategies.
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
 * Fetch lane-specific keyword seeds and journey resource stage hints.
 * Loaded directly from bundled JSON defaults to keep planning hints independent
 * of DB-managed REGION and STRATEGY rows.
 * Returns empty maps when sections are absent or malformed.
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
 * Throws when neither DB nor JSON fallback yields any pinned strategies.
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

/**
 * Report the current config source (DB or JSON fallback).
 * Useful for diagnostics when validating migration/seed state.
 */
export async function getRuntimeConfigSource(): Promise<ConfigSource> {
  const { source } = await loadConfigRows();
  return source;
}
