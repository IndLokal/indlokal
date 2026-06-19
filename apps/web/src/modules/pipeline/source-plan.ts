import { db } from '@/lib/db';
import {
  getRuntimeLaneKeywordSeeds,
  getRuntimeKeywordSeeds,
  getRuntimeKeywordStrategies,
  getRuntimePinnedStrategies,
} from './runtime-config';
import { getDbCommunityStrategies, scorePinnedEventUrl } from './db-sources';
import { getApprovedDynamicKeywords } from './intelligence';
import type { SearchRegion, SearchStrategy, SourceLane } from './types';
import type { KeywordStrategyTemplate } from './runtime-config';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };

type CityGap = {
  slug: string;
  name: string;
  communityCount: number;
  upcomingEventCount: number;
};

type PipelineSourcePlanLaneKey = SourceLane | 'UNKNOWN';

type PipelineSourcePlanLaneBreakdown = Record<
  PipelineSourcePlanLaneKey,
  {
    keywordStrategies: number;
    pinnedStrategies: number;
  }
>;

export type PipelineSourcePlan = {
  keywordStrategies: KeywordStrategy[];
  pinnedStrategies: PinnedStrategy[];
  staticPinnedCount: number;
  dbPinnedCount: number;
  totalDbPinnedCount: number;
  cityGaps: CityGap[];
  laneBreakdown: PipelineSourcePlanLaneBreakdown;
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

const JOURNEY_RESOURCE_STAGE_ORDER = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
] as const;

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function quoteGoogleKeyword(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${trimmed}"`;
}

function renderGoogleKeywordQueries(keywords: string[]): string[] {
  const groupSize = 3;
  const rendered: string[] = [];

  for (let index = 0; index < keywords.length; index += groupSize) {
    const group = keywords.slice(index, index + groupSize).map(quoteGoogleKeyword);
    if (group.length > 0) rendered.push(group.join(' OR '));
  }

  return rendered;
}

function renderKeywordsForSource(
  sourceType: SearchStrategy['sourceType'],
  keywords: string[],
): string[] {
  if (sourceType === 'GOOGLE_SEARCH') {
    return renderGoogleKeywordQueries(keywords);
  }

  return keywords;
}

function expandTemplates(templates: readonly string[], cities: Array<{ name: string }>): string[] {
  return unique(
    cities.flatMap((city) => templates.map((template) => template.replace('{city}', city.name))),
  );
}

function getLaneKey(lane: SourceLane | undefined): PipelineSourcePlanLaneKey {
  return lane ?? 'UNKNOWN';
}

function getGapKeywordsForStrategy(
  strategy: KeywordStrategyTemplate,
  eventGapKeywords: string[],
  communityGapKeywords: string[],
  resourceGapKeywords: string[],
): string[] {
  if (strategy.lane === 'EVENT') return eventGapKeywords;
  if (strategy.lane === 'COMMUNITY') return communityGapKeywords;
  if (strategy.lane === 'RESOURCE') return resourceGapKeywords;

  // Back-compat for legacy rows without explicit lane metadata.
  return strategy.sourceType === 'EVENTBRITE'
    ? eventGapKeywords
    : [...eventGapKeywords, ...communityGapKeywords];
}

function getLaneSeedKeywords(
  strategy: KeywordStrategyTemplate,
  laneSeedMap: Partial<Record<SourceLane, string[]>>,
  fallback: string[],
): string[] {
  if (!strategy.lane) return fallback;
  const laneSeeds = laneSeedMap[strategy.lane];
  return laneSeeds != null && laneSeeds.length > 0 ? laneSeeds : fallback;
}

function buildLaneBreakdown(
  keywordStrategies: KeywordStrategy[],
  pinnedStrategies: PinnedStrategy[],
): PipelineSourcePlanLaneBreakdown {
  const breakdown: PipelineSourcePlanLaneBreakdown = {
    COMMUNITY: { keywordStrategies: 0, pinnedStrategies: 0 },
    EVENT: { keywordStrategies: 0, pinnedStrategies: 0 },
    RESOURCE: { keywordStrategies: 0, pinnedStrategies: 0 },
    UNKNOWN: { keywordStrategies: 0, pinnedStrategies: 0 },
  };

  for (const strategy of keywordStrategies) {
    breakdown[getLaneKey(strategy.lane)].keywordStrategies += 1;
  }
  for (const strategy of pinnedStrategies) {
    breakdown[getLaneKey(strategy.lane)].pinnedStrategies += 1;
  }

  return breakdown;
}

function filterPinnedStrategiesForRun(
  strategies: PinnedStrategy[],
  triggeredBy: string,
  notes: string[],
): PinnedStrategy[] {
  if (triggeredBy !== 'cron') return strategies;

  const kept = strategies.filter(
    (strategy) => strategy.lane !== 'RESOURCE' && strategy.lane !== 'COMMUNITY',
  );
  const resourceDropped = strategies.filter((strategy) => strategy.lane === 'RESOURCE').length;
  const communityDropped = strategies.filter((strategy) => strategy.lane === 'COMMUNITY').length;
  if (resourceDropped > 0) {
    notes.push(
      `cron run: skipped ${resourceDropped} RESOURCE pinned strategies (admin/city scoped only)`,
    );
  }
  if (communityDropped > 0) {
    notes.push(
      `cron run: skipped ${communityDropped} COMMUNITY pinned strategies (event-first cron)`,
    );
  }
  return kept;
}

function filterKeywordStrategiesForRun(
  strategies: KeywordStrategy[],
  triggeredBy: string,
  notes: string[],
): KeywordStrategy[] {
  if (triggeredBy !== 'cron') return strategies;

  const kept = strategies.filter(
    (strategy) => strategy.lane !== 'RESOURCE' && strategy.lane !== 'COMMUNITY',
  );
  const resourceDropped = strategies.filter((strategy) => strategy.lane === 'RESOURCE').length;
  const communityDropped = strategies.filter((strategy) => strategy.lane === 'COMMUNITY').length;
  if (resourceDropped > 0) {
    notes.push(
      `cron run: skipped ${resourceDropped} RESOURCE keyword strategies (admin/city scoped only)`,
    );
  }
  if (communityDropped > 0) {
    notes.push(
      `cron run: skipped ${communityDropped} COMMUNITY keyword strategies (event-first cron)`,
    );
  }
  return kept;
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
  if (strategy.hintCitySlug) {
    return `city:${strategy.hintCitySlug.toLowerCase()}`;
  }

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

function isConfigured(strategy: KeywordStrategyTemplate): boolean {
  if (strategy.sourceType === 'EVENTBRITE') return Boolean(process.env.EVENTBRITE_API_KEY);
  if (strategy.sourceType === 'GOOGLE_SEARCH') {
    return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
  }
  return true;
}

function isDuckDuckGoEnabled(): boolean {
  return process.env.PIPELINE_ENABLE_DDG === '1';
}

function limitDuckDuckGoKeywords(keywords: string[], triggeredBy: string): string[] {
  const limitFromEnv = Number.parseInt(process.env.PIPELINE_DDG_KEYWORD_LIMIT ?? '', 10);
  const defaultLimit = triggeredBy === 'cron' ? 8 : triggeredBy === 'admin' ? 16 : 12;
  const limit = Number.isFinite(limitFromEnv) && limitFromEnv > 0 ? limitFromEnv : defaultLimit;
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
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      communityCount: city.communityCount,
      upcomingEventCount: city.upcomingEventCount,
    }))
    .slice(0, limit);
}

export async function buildPipelineSourcePlan(
  regions: SearchRegion[],
  triggeredBy: string,
): Promise<PipelineSourcePlan> {
  const isTimeBoundRun = triggeredBy === 'cron' || triggeredBy === 'admin';
  const notes: string[] = [];
  const forceKeywordSearch = process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';
  const forceAdminKeywordSearch = process.env.PIPELINE_ADMIN_FORCE_KEYWORD_SEARCH === '1';

  const staticPinned = filterPinnedStrategiesForRun(
    await getRuntimePinnedStrategies(),
    triggeredBy,
    notes,
  );
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

  const shouldRunKeywords = forceKeywordSearch || forceAdminKeywordSearch || cityGaps.length > 0;
  if (!shouldRunKeywords) {
    notes.push('skipping keyword search: no low-coverage DB city gaps');
  }
  if (triggeredBy === 'admin' && forceAdminKeywordSearch && !forceKeywordSearch) {
    notes.push('admin run: forcing keyword search for wider discovery coverage');
  }

  const approvedKeywords = shouldRunKeywords ? await getApprovedDynamicKeywords() : [];
  const baselineKeywordSeeds = shouldRunKeywords ? await getRuntimeKeywordSeeds() : [];
  const laneKeywordSeeds = shouldRunKeywords ? await getRuntimeLaneKeywordSeeds() : null;
  const eventGapKeywords = expandTemplates(EVENT_GAP_TEMPLATES, cityGaps);
  const communityGapKeywords = expandTemplates(COMMUNITY_GAP_TEMPLATES, cityGaps);
  const resourceJourneyGapKeywords =
    triggeredBy === 'admin' && laneKeywordSeeds
      ? unique(
          JOURNEY_RESOURCE_STAGE_ORDER.flatMap(
            (stage) => laneKeywordSeeds.journeyResourceByStage[stage] ?? [],
          ),
        )
      : [];

  const keywordStrategies = shouldRunKeywords
    ? (await getRuntimeKeywordStrategies()).flatMap((strategy) => {
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

        const gapKeywords = getGapKeywordsForStrategy(
          strategy,
          eventGapKeywords,
          communityGapKeywords,
          resourceJourneyGapKeywords,
        );
        const baselineKeywords =
          forceKeywordSearch || forceAdminKeywordSearch
            ? laneKeywordSeeds
              ? getLaneSeedKeywords(strategy, laneKeywordSeeds.byLane, baselineKeywordSeeds)
              : baselineKeywordSeeds
            : [];
        const canonicalKeywords = unique([
          ...gapKeywords,
          ...approvedKeywords,
          ...baselineKeywords,
        ]);
        const renderedKeywords = renderKeywordsForSource(strategy.sourceType, canonicalKeywords);
        const limitedKeywords =
          strategy.sourceType === 'DUCKDUCKGO'
            ? limitDuckDuckGoKeywords(renderedKeywords, triggeredBy)
            : renderedKeywords;

        if (limitedKeywords.length === 0) return [];
        return [{ ...strategy, keywords: limitedKeywords }];
      })
    : [];
  const filteredKeywordStrategies = filterKeywordStrategiesForRun(
    keywordStrategies,
    triggeredBy,
    notes,
  );

  const pinnedStrategies = [...staticPinned, ...dbPinned];
  const laneBreakdown = buildLaneBreakdown(filteredKeywordStrategies, pinnedStrategies);
  notes.push(
    `lane distribution: ${Object.entries(laneBreakdown)
      .map(([lane, counts]) => `${lane}:k${counts.keywordStrategies}/p${counts.pinnedStrategies}`)
      .join(' ')}`,
  );

  return {
    keywordStrategies: filteredKeywordStrategies,
    pinnedStrategies,
    staticPinnedCount: staticPinned.length,
    dbPinnedCount: dbPinned.length,
    totalDbPinnedCount: dbPinnedAll.length,
    cityGaps,
    laneBreakdown,
    notes,
  };
}
