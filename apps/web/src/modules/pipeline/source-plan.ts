/**
 * Pipeline source planner.
 *
 * Builds an executable source plan by combining runtime-configured keyword
 * and pinned strategies with live DB coverage signals.
 *
 * Responsibilities:
 * - detect event/community coverage gaps for requested region cities
 * - decide whether keyword discovery should run for this trigger context
 * - apply lane-aware filtering for cron/admin execution modes
 * - prioritize and cap DB-pinned sources for balanced coverage
 * - return lane breakdown and planner notes for observability
 *
 * Keyword shaping (Google batching, gap template expansion, journey-stage
 * resource hint flattening) is delegated to source-plan-keywords.ts.
 */
import { db } from '@/lib/db';
import {
  getRuntimeLaneKeywordSeeds,
  getRuntimeKeywordStrategies,
  getRuntimePinnedStrategies,
} from './runtime-config';
import { getDbCommunityStrategies, scorePinnedEventUrl } from './db-sources';
import {
  getApprovedDynamicKeywordsByLane,
  type ApprovedDynamicKeywordsByLane,
} from './intelligence';
import {
  buildGapKeywordsByLane,
  getAdminResourceJourneyKeywords,
  getGapKeywordsForStrategy,
  renderKeywordsForSource,
} from './source-plan-keywords';
import type { SearchRegion, SearchStrategy, SourceLane } from './types';
import type { KeywordStrategyTemplate } from './runtime-config';

type KeywordStrategy = SearchStrategy & { kind: 'keyword_search' };
type PinnedStrategy = SearchStrategy & { kind: 'pinned_url' };

type CityGap = {
  slug: string;
  name: string;
  communityCount: number;
  upcomingEventCount: number;
  hasEventGap: boolean;
  hasCommunityGap: boolean;
};

type PipelineSourcePlanLaneKey = SourceLane | 'UNKNOWN';

/**
 * Lane breakdown counts strategies by EVENT, COMMUNITY, RESOURCE, and UNKNOWN lanes.
 * Used to report what sources the planner decided to run in this execution.
 */
type PipelineSourcePlanLaneBreakdown = Record<
  PipelineSourcePlanLaneKey,
  {
    keywordStrategies: number;
    pinnedStrategies: number;
  }
>;

/**
 * Full execution plan for a pipeline run.
 * Contains all keyword and pinned strategies to execute, city gaps, and lane distribution.
 */
export type PipelineSourcePlan = {
  keywordStrategies: KeywordStrategy[];
  pinnedStrategies: PinnedStrategy[];
  staticPinnedCount: number;
  dbPinnedCount: number;
  totalDbPinnedCount: number;
  eventGaps: CityGap[];
  communityGaps: CityGap[];
  laneBreakdown: PipelineSourcePlanLaneBreakdown;
  notes: string[];
};

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getLaneKey(lane: SourceLane | undefined): PipelineSourcePlanLaneKey {
  return lane ?? 'UNKNOWN';
}

function formatGapReasonSummary(city: CityGap): string {
  const reasons: string[] = [];
  if (city.hasEventGap) {
    reasons.push(`event(c${city.communityCount}/e${city.upcomingEventCount})`);
  }
  if (city.hasCommunityGap) {
    reasons.push(`community(c${city.communityCount}/e${city.upcomingEventCount})`);
  }
  return `${city.slug}:${reasons.join('+')}`;
}

function getLaneSeedKeywords(
  strategy: KeywordStrategyTemplate,
  laneSeedMap: Partial<Record<SourceLane, string[]>>,
): string[] {
  if (!strategy.lane) return [];
  const laneSeeds = laneSeedMap[strategy.lane];
  return laneSeeds != null && laneSeeds.length > 0 ? laneSeeds : [];
}

function getApprovedKeywordsForStrategy(
  strategy: KeywordStrategyTemplate,
  approvedKeywords: ApprovedDynamicKeywordsByLane,
): string[] {
  if (strategy.lane) return approvedKeywords.byLane[strategy.lane] ?? [];
  return [];
}

/**
 * Count strategies by lane for observability.
 * Returns a summary of how many keyword and pinned strategies target each lane.
 */
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

/**
 * Apply lane-based filtering for cron-triggered runs.
 * Cron runs only execute EVENT pinned strategies; RESOURCE and COMMUNITY are admin/city scoped.
 * Logs skipped strategies in the notes array for observability.
 */
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

/**
 * Apply lane-based filtering for cron-triggered runs.
 * Cron runs only execute EVENT keyword strategies; RESOURCE and COMMUNITY require admin/city scoping.
 * Logs skipped strategies in the notes array for observability.
 */
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

/**
 * Sort pinned strategies by scored priority, preserving relative order for ties.
 * Higher priority URLs (official sources, strong domains) run first in a batch.
 */
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

/**
 * Compute the grouping key for a pinned source.
 * Used to ensure balanced distribution across cities and origins when limiting results.
 * Returns 'city:slug' if a city hint is present, or 'origin:hostname' if the URL is valid.
 */
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

/**
 * Cap pinned sources to a limit while balancing across buckets (cities/origins).
 * Round-robin picks one source per bucket in each pass, ensuring diverse coverage.
 * Prevents any single city or origin from monopolizing the execution budget.
 */
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

/**
 * Check if a strategy has required credentials/configuration to run.
 * Certain source types (EVENTBRITE, GOOGLE_SEARCH) require API keys; others are always available.
 */
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
): Promise<{ eventGaps: CityGap[]; communityGaps: CityGap[] }> {
  const regionCitySlugs = Array.from(new Set(regions.flatMap((region) => region.citySlugs)));
  if (regionCitySlugs.length === 0) return { eventGaps: [], communityGaps: [] };

  const cities = await db.city.findMany({
    where: { slug: { in: regionCitySlugs } },
    select: { id: true, slug: true, name: true, isMetroPrimary: true },
  });
  if (cities.length === 0) return { eventGaps: [], communityGaps: [] };

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

  const allGapCities = cities
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      communityCount: countByCityId.get(city.id) ?? 0,
      upcomingEventCount: upcomingEventCountByCityId.get(city.id) ?? 0,
      isMetroPrimary: city.isMetroPrimary,
    }))
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
    });

  const gapCities = allGapCities
    .filter(
      (city) =>
        city.communityCount <= communityThreshold || city.upcomingEventCount <= eventThreshold,
    )
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      communityCount: city.communityCount,
      upcomingEventCount: city.upcomingEventCount,
      hasEventGap: city.upcomingEventCount <= eventThreshold,
      hasCommunityGap: city.communityCount <= communityThreshold,
    }))
    .slice(0, limit);

  // Split gap cities by gap type for lane-specific keyword expansion.
  const eventGaps = gapCities.filter((city) => city.hasEventGap);
  const communityGaps = gapCities.filter((city) => city.hasCommunityGap);

  return { eventGaps, communityGaps };
}

/**
 * Build the complete source plan for a pipeline run.
 *
 * Fetches runtime-configured keyword and pinned strategies, filters by lane and run context,
 * identifies cities with content gaps, and returns a breakdown for execution.
 *
 * Key behaviors:
 *   - Cron runs filter out COMMUNITY and RESOURCE lanes (event-first only)
 *   - Admin/manual runs include all lanes
 *   - Pinned strategies are prioritized by scored domain strength
 *   - Keyword strategies are expanded with gap-analysis templates for low-coverage cities
 *   - Lane metrics track how many strategies target each content lane
 *
 * @param regions - enabled search regions (from runtime config)
 * @param triggeredBy - execution context: 'cron', 'admin', or 'cli'
 * @returns Plan containing strategies, city gaps, and lane breakdown
 */
export async function buildPipelineSourcePlan(
  regions: SearchRegion[],
  triggeredBy: string,
): Promise<PipelineSourcePlan> {
  const isTimeBoundRun = triggeredBy === 'cron' || triggeredBy === 'admin';
  const notes: string[] = [];
  const forceKeywordSearch = process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';
  const forceAdminKeywordSearch =
    triggeredBy === 'admin' && process.env.PIPELINE_ADMIN_FORCE_KEYWORD_SEARCH === '1';

  const staticPinned = await getRuntimePinnedStrategies();
  const dbPinnedAll = await getDbCommunityStrategies();
  const dbPinnedLimit = getPositiveIntEnv(
    'PIPELINE_DB_PINNED_LIMIT',
    isTimeBoundRun ? 40 : dbPinnedAll.length,
  );
  const prioritizedDbPinned = prioritizeDbPinnedSources(dbPinnedAll);
  const dbPinned = limitDbPinnedSources(prioritizedDbPinned, dbPinnedLimit);
  const { eventGaps, communityGaps } = await getLowCoverageCities(regions, isTimeBoundRun);

  if (dbPinned.length < dbPinnedAll.length) {
    notes.push(`limited DB pinned sources to ${dbPinned.length}/${dbPinnedAll.length}`);
  }

  const allGapCities = [...eventGaps, ...communityGaps];
  if (allGapCities.length > 0) {
    const gapCitySummaries = Array.from(
      new Map(allGapCities.map((city) => [city.slug, city])).values(),
    );
    notes.push(`DB-gap cities: ${gapCitySummaries.map(formatGapReasonSummary).join(', ')}`);
  }

  const shouldRunKeywords =
    forceKeywordSearch ||
    forceAdminKeywordSearch ||
    eventGaps.length > 0 ||
    communityGaps.length > 0;
  if (!shouldRunKeywords) {
    notes.push('skipping keyword search: no low-coverage DB city gaps');
  }
  if (forceAdminKeywordSearch && !forceKeywordSearch) {
    notes.push('admin run: forcing keyword search for wider discovery coverage');
  }

  const approvedKeywords = shouldRunKeywords
    ? await getApprovedDynamicKeywordsByLane()
    : {
        byLane: { EVENT: [], COMMUNITY: [], RESOURCE: [] },
      };
  const laneKeywordSeeds = shouldRunKeywords ? await getRuntimeLaneKeywordSeeds() : null;
  const resourceJourneyGapKeywords = getAdminResourceJourneyKeywords(triggeredBy, laneKeywordSeeds);
  const gapKeywordsByLane = buildGapKeywordsByLane(
    eventGaps,
    communityGaps,
    resourceJourneyGapKeywords,
  );

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

        const gapKeywords = getGapKeywordsForStrategy(strategy, gapKeywordsByLane);
        const laneSeedsForStrategy = laneKeywordSeeds
          ? getLaneSeedKeywords(strategy, laneKeywordSeeds.byLane)
          : [];
        const baselineKeywords =
          forceKeywordSearch || forceAdminKeywordSearch ? laneSeedsForStrategy : [];
        const approvedKeywordsForStrategy = getApprovedKeywordsForStrategy(
          strategy,
          approvedKeywords,
        );
        const canonicalKeywords = unique([
          ...gapKeywords,
          ...approvedKeywordsForStrategy,
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

  // Debug note if keyword search was planned but all strategies were filtered.
  if (shouldRunKeywords && keywordStrategies.length > 0 && filteredKeywordStrategies.length === 0) {
    notes.push(
      'warning: keyword search was requested but all strategies were filtered by lane context',
    );
  }

  // Combine pinned strategies and apply lane filtering consistently.
  const allPinnedStrategies = [...staticPinned, ...dbPinned];
  const pinnedStrategies = filterPinnedStrategiesForRun(allPinnedStrategies, triggeredBy, notes);

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
    eventGaps,
    communityGaps,
    laneBreakdown,
    notes,
  };
}
