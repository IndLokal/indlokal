import { db } from '@/lib/db';
import { getKeywordStrategies, getPinnedStrategies } from './config';
import { getDbCommunityStrategies, scorePinnedEventUrl } from './db-sources';
import { getApprovedDynamicKeywords } from './intelligence';
import type { SearchRegion, SearchStrategy } from './types';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };

export type PipelineSourcePlan = {
  keywordStrategies: KeywordStrategy[];
  pinnedStrategies: PinnedStrategy[];
  staticPinnedCount: number;
  dbPinnedCount: number;
  totalDbPinnedCount: number;
  cityGaps: Array<{ slug: string; name: string; communityCount: number }>;
  notes: string[];
};

const EVENT_GAP_TEMPLATES = [
  'Indian event {city}',
  'Indian meetup {city}',
  'South Asian festival {city}',
  'indische Veranstaltung {city}',
] as const;

const COMMUNITY_GAP_TEMPLATES = [
  'Indian community group {city}',
  'South Asian community {city}',
  'Indian student group {city}',
  'Indian professionals network {city}',
  'indische Community {city}',
  'indischer Verein {city}',
] as const;

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function expandTemplates(templates: readonly string[], cities: Array<{ name: string }>): string[] {
  return unique(
    cities.flatMap((city) => templates.map((template) => template.replace('{city}', city.name))),
  );
}

function prioritizeDbPinnedSources(strategies: PinnedStrategy[]): PinnedStrategy[] {
  return strategies
    .map((strategy, index) => ({
      strategy,
      index,
      priority: scorePinnedEventUrl(strategy.url ?? '', strategy.label),
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.index - b.index;
    })
    .map(({ strategy }) => strategy);
}

function isConfigured(strategy: KeywordStrategy): boolean {
  if (strategy.sourceType === 'EVENTBRITE') return Boolean(process.env.EVENTBRITE_API_KEY);
  if (strategy.sourceType === 'GOOGLE_SEARCH') {
    return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
  }
  return true;
}

function isDuckDuckGoEnabled(): boolean {
  return process.env.PIPELINE_ENABLE_DDG === '1';
}

function limitDuckDuckGoKeywords(keywords: string[], isCronRun: boolean): string[] {
  const limitFromEnv = Number.parseInt(process.env.PIPELINE_DDG_KEYWORD_LIMIT ?? '', 10);
  const limit =
    Number.isFinite(limitFromEnv) && limitFromEnv > 0 ? limitFromEnv : isCronRun ? 8 : 12;
  return keywords.slice(0, limit);
}

async function getLowCoverageCities(
  regions: SearchRegion[],
  isCronRun: boolean,
): Promise<Array<{ slug: string; name: string; communityCount: number }>> {
  const regionCitySlugs = Array.from(new Set(regions.flatMap((region) => region.citySlugs)));
  if (regionCitySlugs.length === 0) return [];

  const cities = await db.city.findMany({
    where: { slug: { in: regionCitySlugs } },
    select: { id: true, slug: true, name: true },
  });
  if (cities.length === 0) return [];

  const communitiesByCity = await db.community.groupBy({
    by: ['cityId'],
    where: {
      cityId: { in: cities.map((city) => city.id) },
      mergedIntoId: null,
      status: { in: ['ACTIVE', 'CLAIMED', 'UNVERIFIED'] },
    },
    _count: { _all: true },
  });

  const countByCityId = new Map(communitiesByCity.map((row) => [row.cityId, row._count._all]));
  const threshold = getPositiveIntEnv('PIPELINE_DB_GAP_CITY_THRESHOLD', isCronRun ? 2 : 3);
  const limit = getPositiveIntEnv('PIPELINE_DB_GAP_CITY_LIMIT', isCronRun ? 4 : 6);

  return cities
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      communityCount: countByCityId.get(city.id) ?? 0,
    }))
    .filter((city) => city.communityCount <= threshold)
    .sort((a, b) => a.communityCount - b.communityCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function buildPipelineSourcePlan(
  regions: SearchRegion[],
  triggeredBy: string,
): Promise<PipelineSourcePlan> {
  const isCronRun = triggeredBy === 'cron';
  const notes: string[] = [];
  const forceKeywordSearch = process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';

  const staticPinned = getPinnedStrategies();
  const dbPinnedAll = await getDbCommunityStrategies();
  const dbPinnedLimit = getPositiveIntEnv(
    'PIPELINE_DB_PINNED_LIMIT',
    isCronRun ? 40 : dbPinnedAll.length,
  );
  const prioritizedDbPinned = prioritizeDbPinnedSources(dbPinnedAll);
  const dbPinned = prioritizedDbPinned.slice(0, dbPinnedLimit);
  const cityGaps = await getLowCoverageCities(regions, isCronRun);

  if (dbPinned.length < dbPinnedAll.length) {
    notes.push(`limited DB pinned sources to ${dbPinned.length}/${dbPinnedAll.length}`);
  }

  if (cityGaps.length > 0) {
    notes.push(
      `DB-gap cities: ${cityGaps.map((city) => `${city.slug}:${city.communityCount}`).join(', ')}`,
    );
  }

  const shouldRunKeywords = forceKeywordSearch || cityGaps.length > 0;
  if (!shouldRunKeywords) {
    notes.push('skipping keyword search: no low-coverage DB city gaps');
  }

  const approvedKeywords = shouldRunKeywords ? await getApprovedDynamicKeywords() : [];
  const eventGapKeywords = expandTemplates(EVENT_GAP_TEMPLATES, cityGaps);
  const communityGapKeywords = expandTemplates(COMMUNITY_GAP_TEMPLATES, cityGaps);

  const keywordStrategies = shouldRunKeywords
    ? getKeywordStrategies().flatMap((strategy) => {
        if (strategy.sourceType === 'DUCKDUCKGO' && !isDuckDuckGoEnabled()) {
          notes.push(
            `skipping ${strategy.id}: disabled by default; set PIPELINE_ENABLE_DDG=1 to enable`,
          );
          return [];
        }

        if (!isConfigured(strategy)) {
          notes.push(`skipping ${strategy.id}: required API credentials are not configured`);
          return [];
        }

        const gapKeywords =
          strategy.sourceType === 'EVENTBRITE'
            ? eventGapKeywords
            : [...eventGapKeywords, ...communityGapKeywords];
        const fallbackKeywords = forceKeywordSearch ? strategy.keywords : [];
        const keywords = unique([...gapKeywords, ...approvedKeywords, ...fallbackKeywords]);
        const limitedKeywords =
          strategy.sourceType === 'DUCKDUCKGO'
            ? limitDuckDuckGoKeywords(keywords, isCronRun)
            : keywords;

        if (limitedKeywords.length === 0) return [];
        return [{ ...strategy, keywords: limitedKeywords }];
      })
    : [];

  return {
    keywordStrategies,
    pinnedStrategies: [...staticPinned, ...dbPinned],
    staticPinnedCount: staticPinned.length,
    dbPinnedCount: dbPinned.length,
    totalDbPinnedCount: dbPinnedAll.length,
    cityGaps,
    notes,
  };
}
