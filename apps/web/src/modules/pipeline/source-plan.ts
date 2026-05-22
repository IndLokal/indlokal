import { db } from '@/lib/db';
import { getKeywordStrategies, getPinnedStrategies } from './config';
import { getDbCommunityStrategies, scorePinnedEventUrl } from './db-sources';
import { getApprovedDynamicKeywords } from './intelligence';
import type { SearchRegion, SearchStrategy } from './types';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };

type CityGap = {
  slug: string;
  name: string;
  communityCount: number;
  upcomingEventCount: number;
};

export type PipelineSourcePlan = {
  keywordStrategies: KeywordStrategy[];
  pinnedStrategies: PinnedStrategy[];
  staticPinnedCount: number;
  dbPinnedCount: number;
  totalDbPinnedCount: number;
  cityGaps: CityGap[];
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

function getDbPinnedBucketKey(strategy: PinnedStrategy): string {
  try {
    const parsed = new URL(strategy.url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'meetup.com' || host.endsWith('.meetup.com')) {
      const firstPathSegment = parsed.pathname.split('/').filter(Boolean)[0];
      if (firstPathSegment) return `origin:${host}/${firstPathSegment.toLowerCase()}`;
    }
    return `origin:${host}`;
  } catch {
    // Fall back to city bucketing when the URL cannot be parsed.
  }

  return `city:${strategy.hintCitySlug ?? '__unknown__'}`;
}

function limitDbPinnedSources(strategies: PinnedStrategy[], limit: number): PinnedStrategy[] {
  if (limit >= strategies.length) return strategies;

  const grouped = new Map<string, PinnedStrategy[]>();
  const groupOrder: string[] = [];

  for (const strategy of strategies) {
    const key = getDbPinnedBucketKey(strategy);
    if (!grouped.has(key)) {
      grouped.set(key, []);
      groupOrder.push(key);
    }
    grouped.get(key)?.push(strategy);
  }

  const selected: PinnedStrategy[] = [];

  while (selected.length < limit) {
    let pickedInPass = false;

    for (const key of groupOrder) {
      const bucket = grouped.get(key);
      const next = bucket?.shift();
      if (!next) continue;

      selected.push(next);
      pickedInPass = true;

      if (selected.length >= limit) break;
    }

    if (!pickedInPass) break;
  }

  return selected;
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
): Promise<CityGap[]> {
  const regionCitySlugs = Array.from(new Set(regions.flatMap((region) => region.citySlugs)));
  if (regionCitySlugs.length === 0) return [];

  const cities = await db.city.findMany({
    where: { slug: { in: regionCitySlugs } },
    select: { id: true, slug: true, name: true, isMetroPrimary: true },
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

  const upcomingEventsByCity = await db.event.groupBy({
    by: ['cityId'],
    where: {
      cityId: { in: cities.map((city) => city.id) },
      startsAt: { gte: new Date() },
      status: { not: 'CANCELLED' },
    },
    _count: { _all: true },
  });

  const countByCityId = new Map(communitiesByCity.map((row) => [row.cityId, row._count._all]));
  const upcomingEventCountByCityId = new Map(
    upcomingEventsByCity.map((row) => [row.cityId, row._count._all]),
  );
  const communityThreshold = getPositiveIntEnv('PIPELINE_DB_GAP_CITY_THRESHOLD', isCronRun ? 2 : 3);
  const eventThreshold = getPositiveIntEnv('PIPELINE_DB_GAP_EVENT_THRESHOLD', isCronRun ? 1 : 2);
  const limit = getPositiveIntEnv('PIPELINE_DB_GAP_CITY_LIMIT', isCronRun ? 4 : 6);

  return cities
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      communityCount: countByCityId.get(city.id) ?? 0,
      upcomingEventCount: upcomingEventCountByCityId.get(city.id) ?? 0,
      isMetroPrimary: city.isMetroPrimary,
    }))
    .filter(
      (city) =>
        city.communityCount <= communityThreshold || city.upcomingEventCount <= eventThreshold,
    )
    .sort((a, b) => {
      const aHasCommunityBase = a.communityCount > 0 ? 1 : 0;
      const bHasCommunityBase = b.communityCount > 0 ? 1 : 0;
      if (aHasCommunityBase !== bHasCommunityBase) return bHasCommunityBase - aHasCommunityBase;

      if (a.isMetroPrimary !== b.isMetroPrimary) {
        return Number(b.isMetroPrimary) - Number(a.isMetroPrimary);
      }

      if (a.upcomingEventCount !== b.upcomingEventCount) {
        return a.upcomingEventCount - b.upcomingEventCount;
      }

      if (aHasCommunityBase === 1 && a.communityCount !== b.communityCount) {
        return b.communityCount - a.communityCount;
      }

      return a.communityCount - b.communityCount || a.name.localeCompare(b.name);
    })
    .map(({ isMetroPrimary: _isMetroPrimary, ...city }) => city)
    .slice(0, limit);
}

export async function buildPipelineSourcePlan(
  regions: SearchRegion[],
  triggeredBy: string,
): Promise<PipelineSourcePlan> {
  const isTimeBoundRun = triggeredBy === 'cron' || triggeredBy === 'admin';
  const notes: string[] = [];
  const forceKeywordSearch = process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';

  const staticPinned = getPinnedStrategies();
  const dbPinnedAll = await getDbCommunityStrategies();
  const dbPinnedLimit = getPositiveIntEnv(
    'PIPELINE_DB_PINNED_LIMIT',
    isTimeBoundRun ? 40 : dbPinnedAll.length,
  );
  const prioritizedDbPinned = prioritizeDbPinnedSources(dbPinnedAll);
  const dbPinned = limitDbPinnedSources(prioritizedDbPinned, dbPinnedLimit);
  const cityGaps = await getLowCoverageCities(regions, isTimeBoundRun);

  if (dbPinned.length < dbPinnedAll.length) {
    notes.push(`limited DB pinned sources to ${dbPinned.length}/${dbPinnedAll.length}`);
  }

  if (cityGaps.length > 0) {
    notes.push(
      `DB-gap cities: ${cityGaps.map((city) => `${city.slug}:c${city.communityCount}/e${city.upcomingEventCount}`).join(', ')}`,
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
            ? limitDuckDuckGoKeywords(keywords, isTimeBoundRun)
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
