import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { ACTIVE_CITY_DATA, SATELLITE_CITY_DATA, UPCOMING_CITIES } from '../src/lib/config/cities';

type SqlClient = PrismaClient | Prisma.TransactionClient;

type SourceDefaultsRegion = {
  id: string;
  label: string;
  searchCenter: string;
  state: string;
  enabled: boolean;
};

type SourceDefaultsStrategy = {
  id: string;
  sourceType: string;
  kind: 'keyword_search' | 'pinned_url';
  contentScope:
    | 'keyword_discovery'
    | 'official_portal'
    | 'official_events'
    | 'directory_listing'
    | 'community_events'
    | 'community_portal';
  label: string;
  enabled: boolean;
  radiusKm?: number;
  url?: string;
  hintCitySlug?: string;
  hintState?: string;
  scope?: 'GENERIC' | 'CITY' | 'REGION';
};

type SourceDefaults = {
  baselineKeywords: string[];
  regions: SourceDefaultsRegion[];
  strategies: SourceDefaultsStrategy[];
};

type PipelineConfigRow = {
  configType: 'KEYWORD' | 'REGION' | 'STRATEGY';
  key: string;
  label: string;
  enabled: boolean;
  sourceType: string | null;
  kind: string | null;
  payload: Prisma.JsonObject;
};

const ALLOWED_CONTENT_SCOPES = new Set<SourceDefaultsStrategy['contentScope']>([
  'keyword_discovery',
  'official_portal',
  'official_events',
  'directory_listing',
  'community_events',
  'community_portal',
]);

const ALLOWED_SOURCE_TYPES = new Set<string>([
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
  'USER_SUBMITTED',
]);

const ALLOWED_PINNED_SCOPES = new Set<'GENERIC' | 'CITY' | 'REGION'>(['GENERIC', 'CITY', 'REGION']);

const KNOWN_STATES = new Set<string>([
  ...ACTIVE_CITY_DATA.map((city) => city.state),
  ...SATELLITE_CITY_DATA.map((city) => city.state),
  ...UPCOMING_CITIES.map((city) => city.state),
]);

const KNOWN_CITY_SLUGS = new Set(
  [...ACTIVE_CITY_DATA, ...SATELLITE_CITY_DATA]
    .map((city) => city.slug)
    .concat(UPCOMING_CITIES.map((city) => city.slug)),
);

/**
 * Derive the set of city slugs that belong to a region's state.
 * Pulls from active metros, their satellites, and upcoming metros so that
 * adding a city to cities.ts automatically extends pipeline coverage.
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

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function assertNoDuplicates(values: string[], name: string) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  if (duplicates.length > 0) {
    throw new Error(
      `[Pipeline] Duplicate ${name} values in pipeline-source-defaults.json: ${duplicates.join(', ')}`,
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );
}

function parseSourceDefaults(raw: unknown): SourceDefaults {
  if (!isObject(raw)) {
    throw new Error('[Pipeline] pipeline-source-defaults.json must contain an object');
  }

  const regionsRaw = Array.isArray(raw.regions) ? raw.regions : [];
  const strategiesRaw = Array.isArray(raw.strategies) ? raw.strategies : [];
  const baselineKeywords = normalizeStringArray(raw.baselineKeywords);
  const normalizedBaselineKeywords = baselineKeywords.map(normalizeKeyword);
  const parseErrors: string[] = [];

  const regions: SourceDefaultsRegion[] = regionsRaw
    .filter(isObject)
    .map((region) => ({
      id: typeof region.id === 'string' ? region.id : '',
      label: typeof region.label === 'string' ? region.label : '',
      searchCenter: typeof region.searchCenter === 'string' ? region.searchCenter : '',
      state: typeof region.state === 'string' ? region.state : '',
      enabled: region.enabled !== false,
    }))
    .filter(
      (region) =>
        region.id.length > 0 &&
        region.label.length > 0 &&
        region.searchCenter.length > 0 &&
        region.state.length > 0,
    );

  for (const region of regions) {
    if (!region.enabled) continue;
    if (!KNOWN_STATES.has(region.state)) {
      parseErrors.push(
        `[Pipeline] Enabled region ${region.id} references unknown state '${region.state}'. Add a city with that state to cities.ts first.`,
      );
      continue;
    }
    if (getCitySlugsForState(region.state).length === 0) {
      parseErrors.push(
        `[Pipeline] Region ${region.id} state '${region.state}' resolves to zero cities`,
      );
    }
  }

  const strategies: SourceDefaultsStrategy[] = [];
  for (const rawStrategy of strategiesRaw) {
    if (!isObject(rawStrategy)) continue;
    const kindRaw = rawStrategy.kind;
    if (kindRaw !== 'keyword_search' && kindRaw !== 'pinned_url') continue;

    const candidate: SourceDefaultsStrategy = {
      id: typeof rawStrategy.id === 'string' ? rawStrategy.id : '',
      sourceType: typeof rawStrategy.sourceType === 'string' ? rawStrategy.sourceType : '',
      kind: kindRaw,
      contentScope:
        typeof rawStrategy.contentScope === 'string'
          ? (rawStrategy.contentScope as SourceDefaultsStrategy['contentScope'])
          : ('' as SourceDefaultsStrategy['contentScope']),
      label: typeof rawStrategy.label === 'string' ? rawStrategy.label : '',
      enabled: rawStrategy.enabled !== false,
      radiusKm: typeof rawStrategy.radiusKm === 'number' ? rawStrategy.radiusKm : undefined,
      url: typeof rawStrategy.url === 'string' ? rawStrategy.url : undefined,
      hintCitySlug:
        typeof rawStrategy.hintCitySlug === 'string' ? rawStrategy.hintCitySlug : undefined,
      hintState: typeof rawStrategy.hintState === 'string' ? rawStrategy.hintState : undefined,
      scope:
        typeof rawStrategy.scope === 'string'
          ? (rawStrategy.scope as 'GENERIC' | 'CITY' | 'REGION')
          : undefined,
    };

    if (
      candidate.id.length === 0 ||
      candidate.sourceType.length === 0 ||
      candidate.label.length === 0
    ) {
      parseErrors.push('[Pipeline] Strategy row missing id/sourceType/label');
      continue;
    }

    if (!ALLOWED_SOURCE_TYPES.has(candidate.sourceType)) {
      parseErrors.push(
        `[Pipeline] Strategy ${candidate.id} has invalid sourceType ${candidate.sourceType}`,
      );
      continue;
    }

    if (!ALLOWED_CONTENT_SCOPES.has(candidate.contentScope)) {
      parseErrors.push(
        `[Pipeline] Strategy ${candidate.id || '<unknown>'} has missing/invalid contentScope`,
      );
      continue;
    }

    if (candidate.kind === 'keyword_search' && candidate.contentScope !== 'keyword_discovery') {
      parseErrors.push(
        `[Pipeline] Strategy ${candidate.id} keyword_search must use contentScope=keyword_discovery`,
      );
      continue;
    }

    if (candidate.kind === 'keyword_search') {
      if (
        candidate.radiusKm == null ||
        !Number.isFinite(candidate.radiusKm) ||
        candidate.radiusKm <= 0
      ) {
        parseErrors.push(`[Pipeline] Strategy ${candidate.id} has invalid radiusKm`);
        continue;
      }
    } else if (!candidate.url) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} missing url`);
      continue;
    } else {
      try {
        const parsed = new URL(candidate.url);
        if (parsed.protocol !== 'https:') {
          parseErrors.push(`[Pipeline] Strategy ${candidate.id} must use https URL`);
          continue;
        }
      } catch {
        parseErrors.push(`[Pipeline] Strategy ${candidate.id} has invalid url`);
        continue;
      }
    }

    if (candidate.hintCitySlug != null && candidate.hintCitySlug.trim().length === 0) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} has empty hintCitySlug`);
      continue;
    }

    if (candidate.hintCitySlug != null && !KNOWN_CITY_SLUGS.has(candidate.hintCitySlug)) {
      parseErrors.push(
        `[Pipeline] Strategy ${candidate.id} has unknown hintCitySlug ${candidate.hintCitySlug}`,
      );
      continue;
    }

    if (candidate.hintState != null && candidate.hintState.trim().length === 0) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} has empty hintState`);
      continue;
    }

    if (candidate.hintState != null && !KNOWN_STATES.has(candidate.hintState)) {
      parseErrors.push(
        `[Pipeline] Strategy ${candidate.id} has unknown hintState ${candidate.hintState}`,
      );
      continue;
    }

    const inferredScope = candidate.hintCitySlug
      ? 'CITY'
      : candidate.hintState
        ? 'REGION'
        : 'GENERIC';
    const normalizedScope = candidate.scope ?? inferredScope;
    if (!ALLOWED_PINNED_SCOPES.has(normalizedScope)) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} has invalid scope ${candidate.scope}`);
      continue;
    }
    candidate.scope = normalizedScope;

    if (candidate.scope === 'CITY' && !candidate.hintCitySlug) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} scope=CITY requires hintCitySlug`);
      continue;
    }

    if (candidate.scope === 'REGION' && !candidate.hintState) {
      parseErrors.push(`[Pipeline] Strategy ${candidate.id} scope=REGION requires hintState`);
      continue;
    }

    strategies.push(candidate);
  }

  assertNoDuplicates(normalizedBaselineKeywords, 'baseline keyword');
  assertNoDuplicates(
    regions.map((region) => region.id),
    'region id',
  );
  assertNoDuplicates(
    strategies.map((strategy) => strategy.id),
    'strategy id',
  );
  assertNoDuplicates(
    strategies.map((strategy) => normalizeLabel(strategy.label)),
    'strategy label',
  );
  assertNoDuplicates(
    strategies
      .filter((strategy) => strategy.kind === 'pinned_url' && strategy.url)
      .map((strategy) => (strategy.url ?? '').trim().toLowerCase()),
    'pinned URL',
  );

  if (parseErrors.length > 0) {
    throw new Error(
      `[Pipeline] Invalid pipeline-source-defaults.json entries:\n${parseErrors.join('\n')}`,
    );
  }

  if (baselineKeywords.length === 0 || regions.length === 0 || strategies.length === 0) {
    throw new Error(
      '[Pipeline] pipeline-source-defaults.json did not produce valid baselineKeywords/regions/strategies',
    );
  }

  return { baselineKeywords, regions, strategies };
}

async function loadSourceDefaults(): Promise<SourceDefaults> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultsPath = path.join(moduleDir, 'data', 'pipeline-source-defaults.json');
  const raw = await readFile(defaultsPath, 'utf8');
  return parseSourceDefaults(JSON.parse(raw) as unknown);
}

function buildConfigRows(defaults: SourceDefaults): PipelineConfigRow[] {
  const keywordRows: PipelineConfigRow[] = defaults.baselineKeywords.map((keyword) => ({
    configType: 'KEYWORD',
    key: normalizeKeyword(keyword),
    label: keyword,
    enabled: true,
    sourceType: null,
    kind: null,
    payload: {
      origin: 'bootstrap-defaults',
    },
  }));

  const regionRows: PipelineConfigRow[] = defaults.regions.map((region) => ({
    configType: 'REGION',
    key: region.id,
    label: region.label,
    enabled: region.enabled,
    sourceType: null,
    kind: null,
    payload: {
      searchCenter: region.searchCenter,
      state: region.state,
      citySlugs: getCitySlugsForState(region.state),
    },
  }));

  const strategyRows: PipelineConfigRow[] = defaults.strategies.map((strategy) => {
    if (strategy.kind === 'keyword_search') {
      return {
        configType: 'STRATEGY',
        key: strategy.id,
        label: strategy.label,
        enabled: strategy.enabled,
        sourceType: strategy.sourceType,
        kind: strategy.kind,
        payload: {
          radiusKm: strategy.radiusKm ?? 50,
          contentScope: strategy.contentScope,
        },
      };
    }

    return {
      configType: 'STRATEGY',
      key: strategy.id,
      label: strategy.label,
      enabled: strategy.enabled,
      sourceType: strategy.sourceType,
      kind: strategy.kind,
      payload: {
        url: strategy.url ?? null,
        scope: strategy.scope ?? null,
        hintCitySlug: strategy.hintCitySlug ?? null,
        hintState: strategy.hintState ?? null,
        contentScope: strategy.contentScope,
      },
    };
  });

  return [...keywordRows, ...regionRows, ...strategyRows];
}

async function upsertConfigRow(prisma: SqlClient, row: PipelineConfigRow): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO pipeline_source_configs
        (id, config_type, key, label, enabled, source_type, kind, payload, created_at, updated_at)
      VALUES
        (
          ${randomUUID()},
          ${row.configType}::"PipelineSourceConfigType",
          ${row.key},
          ${row.label},
          ${row.enabled},
          ${row.sourceType}::"PipelineSourceType",
          ${row.kind},
          ${row.payload}::jsonb,
          NOW(),
          NOW()
        )
      ON CONFLICT (config_type, key)
      DO UPDATE
      SET
        label = EXCLUDED.label,
        enabled = EXCLUDED.enabled,
        source_type = EXCLUDED.source_type,
        kind = EXCLUDED.kind,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
  );
}

async function disableMissingRows(prisma: SqlClient, rows: PipelineConfigRow[]): Promise<number> {
  const keepKeywordKeys = rows.filter((row) => row.configType === 'KEYWORD').map((row) => row.key);
  const keepRegionKeys = rows.filter((row) => row.configType === 'REGION').map((row) => row.key);
  const keepStrategyKeys = rows
    .filter((row) => row.configType === 'STRATEGY')
    .map((row) => row.key);

  if (
    keepKeywordKeys.length === 0 ||
    keepRegionKeys.length === 0 ||
    keepStrategyKeys.length === 0
  ) {
    return 0;
  }

  const keywordResult = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE pipeline_source_configs
      SET enabled = false, updated_at = NOW()
      WHERE config_type = 'KEYWORD'::"PipelineSourceConfigType"
        AND enabled = true
        AND key NOT IN (${Prisma.join(keepKeywordKeys)})
    `,
  );

  const regionResult = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE pipeline_source_configs
      SET enabled = false, updated_at = NOW()
      WHERE config_type = 'REGION'::"PipelineSourceConfigType"
        AND enabled = true
        AND key NOT IN (${Prisma.join(keepRegionKeys)})
    `,
  );

  const strategyResult = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE pipeline_source_configs
      SET enabled = false, updated_at = NOW()
      WHERE config_type = 'STRATEGY'::"PipelineSourceConfigType"
        AND enabled = true
        AND key NOT IN (${Prisma.join(keepStrategyKeys)})
    `,
  );

  return Number(keywordResult) + Number(regionResult) + Number(strategyResult);
}

export type PipelineSourceConfigBootstrapResult = {
  upserted: number;
  disabledMissing: number;
};

export async function runPipelineSourceConfigBootstrap(
  prisma: PrismaClient,
  options: { disableMissing?: boolean } = {},
): Promise<PipelineSourceConfigBootstrapResult> {
  const defaults = await loadSourceDefaults();
  const rows = buildConfigRows(defaults);

  return prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await upsertConfigRow(tx, row);
    }

    const disabledMissing = options.disableMissing ? await disableMissingRows(tx, rows) : 0;

    return {
      upserted: rows.length,
      disabledMissing,
    };
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const disableMissing = process.argv.includes('--disable-missing');
    const result = await runPipelineSourceConfigBootstrap(prisma, { disableMissing });
    console.log(
      `[Pipeline] Source config bootstrap complete: upserted ${result.upserted}, disabledMissing ${result.disabledMissing}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  process.argv[1]?.endsWith('pipeline-source-config.ts') ||
  process.argv[1]?.endsWith('pipeline-source-config.js');

if (isDirectRun) {
  main().catch((error) => {
    console.error('[Pipeline] Source config bootstrap failed:', error);
    process.exit(1);
  });
}
