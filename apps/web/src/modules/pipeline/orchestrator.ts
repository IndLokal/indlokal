/**
 * Pipeline orchestrator - known-source-first content discovery pipeline.
 *
 * Flow:
 *   1. PLAN - DB + pinned sources first, keyword search only for DB coverage gaps
 *   2. FETCH - execute planned pinned URLs, then planned keyword searches
 *   3. FILTER - Stage 1 LLM: cheap batch relevance check
 *   4. EXTRACT - Stage 2 LLM: structured extraction with city assignment
 *   5. RESOLVE - map LLM cityName → DB city ID
 *   6. DEDUP - semantic/name similarity check against existing DB entities + queue
 *   7. QUEUE - store in PipelineItem for admin review
 *
 * Adding a new country: add region + strategy defaults in source-defaults.json,
 * sync them into DB, and rerun the pipeline. No orchestrator changes needed.
 */

import { db } from '@/lib/db';
import { Prisma, type PipelineSourceType } from '@prisma/client';
import { CITY_NAME_ALIASES } from '@/lib/config/cities';
import { normalizeCityLookupKey, resolveCityMatch } from '@/lib/city-resolution';
import { assessEvidenceUrl } from '@/lib/source-policy';
import { getRuntimeEnabledRegions } from './config/runtime-config';
import {
  fetchEventbriteKeywords,
  fetchPinnedUrl,
  fetchGoogleSearch,
  fetchDuckDuckGoSearch,
} from './sources';
import { extractCalendarEventFromRawContent, isEmbeddedCalendarEventRawContent } from './calendar';
import { scorePinnedEventUrl } from './db-sources';
import {
  STALE_EVENT_MARKERS,
  EVENT_PAGE_MARKERS,
  FRESH_EVENT_MARKERS,
  extractMentionedYears,
} from './freshness';
import { buildPipelineSourcePlan } from './planning/source-plan';
import {
  filterRelevance,
  extractBatch,
  resetLlmStats,
  getLlmStats,
  PipelineBudgetExceededError,
  PipelineCircuitOpenError,
} from './extraction';
import { currentLlmContext, withLlmContext } from './llm-context';
import {
  applySourceConfidenceAdjustment,
  buildSourceReliabilityKey,
  getSourceReliabilityMap,
} from './reliability';
import { semanticCommunityDuplicateCheck } from './intelligence';
import { shouldAutoApprovePipelineItem, approvePipelineItemRecord } from './review';
import { suggestCommunityPersonaSegments } from './journey-tags';
import { FLAGS } from '@/lib/config/flags';
import {
  COMMUNITY_DUPLICATE_SEMANTIC_THRESHOLD,
  DEDUP_ACTIVE_STATUSES,
  DEDUP_QUEUE_SCAN_LIMIT,
  EVENT_DATE_WINDOW_DAYS,
  computeSimilarity,
  findRejectedCommunityMatch,
  findRejectedEventMatch,
  findRejectedResourceMatch,
  hasStrongEventIdentityEvidence,
  isCommunityNameMatch,
  isEventTitleMatch,
  normalizeComparableUrl,
  normalizeCommunityName,
  normalizeSourceUrlForDedup,
} from './dedup';

// Re-export dedup primitives that other modules and unit tests import from here
// for backwards compatibility. The canonical definitions live in ./dedup.
export { computeSimilarity, normalizeEventTitleForDedup } from './dedup';
import type {
  ExtractedData,
  ExtractedEvent,
  ExtractedResource,
  PipelineLaneBreakdown,
  PipelineLaneMetricKey,
  RawContent,
  PipelineRunResult,
  ResolutionProvenance,
  SearchRegion,
} from './types';

// Re-export PipelineRunResult type from types.ts
export type { PipelineRunResult } from './types';

type Region = SearchRegion;

function buildEmptyLaneBreakdown(): PipelineLaneBreakdown {
  return {
    EVENT: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    COMMUNITY: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    RESOURCE: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    UNKNOWN: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
  };
}

function getLaneMetricKeyForRaw(item: RawContent): PipelineLaneMetricKey {
  return item._lane ?? 'UNKNOWN';
}

function getLaneMetricKeyForExtracted(
  item: ExtractedData,
): Exclude<PipelineLaneMetricKey, 'UNKNOWN'> {
  return item.type;
}

function incrementLaneMetric(
  breakdown: PipelineLaneBreakdown,
  lane: PipelineLaneMetricKey,
  field: keyof PipelineLaneBreakdown[PipelineLaneMetricKey],
): void {
  breakdown[lane][field] += 1;
}

export type PipelineRunScope = {
  citySlugs?: string[];
  regionIds?: string[];
};

function filterRegionsByScope(regions: Region[], scope?: PipelineRunScope): Region[] {
  if (!scope) return regions;

  const regionIds = new Set((scope.regionIds ?? []).map((id) => id.trim()).filter(Boolean));
  const citySlugs = new Set((scope.citySlugs ?? []).map((slug) => slug.trim()).filter(Boolean));

  if (regionIds.size === 0 && citySlugs.size === 0) return regions;

  return regions
    .filter((region) => {
      const regionMatch = regionIds.size > 0 && regionIds.has(region.id);
      const cityMatch = citySlugs.size > 0 && region.citySlugs.some((slug) => citySlugs.has(slug));
      return regionMatch || cityMatch;
    })
    .map((region) => ({
      ...region,
      citySlugs:
        citySlugs.size > 0
          ? region.citySlugs.filter((slug) => citySlugs.has(slug))
          : region.citySlugs,
    }))
    .filter((region) => region.citySlugs.length > 0);
}
export function isLikelyStaleEventPage(item: RawContent): boolean {
  const preview = `${item.sourceUrl} ${item.text.slice(0, 1200)}`;
  const lowerPreview = preview.toLowerCase();
  const years = extractMentionedYears(lowerPreview);
  const currentYear = new Date().getFullYear();
  const hasEventMarkers = EVENT_PAGE_MARKERS.test(lowerPreview);
  const hasStaleMarkers = STALE_EVENT_MARKERS.test(lowerPreview);
  const hasFreshMarkers =
    FRESH_EVENT_MARKERS.test(lowerPreview) || years.some((year) => year >= currentYear);
  const onlyPastYears = years.length > 0 && years.every((year) => year < currentYear);
  const score = scorePinnedEventUrl(item.sourceUrl, item.text.slice(0, 400));

  if (hasStaleMarkers && !hasFreshMarkers) return true;
  if (onlyPastYears && hasEventMarkers && !hasFreshMarkers) return true;
  if (score < 0 && hasEventMarkers && !hasFreshMarkers) return true;
  return false;
}

export function prefilterLikelyCurrentItems(items: RawContent[]): RawContent[] {
  return items.filter((item) => !isLikelyStaleEventPage(item));
}

const COMMUNITY_SIGNAL_MARKERS =
  /community|verein|association|network|group|club|chapter|society|organisation|organization|members?|join|student|professionals?|diaspora/i;

function hasLikelyEventSignals(item: RawContent): boolean {
  const preview = `${item.sourceUrl} ${item.text.slice(0, 1200)}`.toLowerCase();
  const years = extractMentionedYears(preview);
  const currentYear = new Date().getFullYear();
  const hasDateLikePattern =
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/.test(preview) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
      preview,
    );
  return (
    EVENT_PAGE_MARKERS.test(preview) ||
    FRESH_EVENT_MARKERS.test(preview) ||
    hasDateLikePattern ||
    years.some((year) => year >= currentYear)
  );
}

function hasLikelyCommunitySignals(item: RawContent): boolean {
  const preview = `${item.sourceUrl} ${item.text.slice(0, 1200)}`;
  return (
    COMMUNITY_SIGNAL_MARKERS.test(preview) ||
    Boolean(item._hintCommunityId) ||
    Boolean(item._hintCommunityName)
  );
}

function isLikelyTrustedResourceSource(item: RawContent): boolean {
  const assessment = assessEvidenceUrl(item.sourceUrl);
  return (
    assessment.tier === 'official_registry' ||
    assessment.tier === 'government_consular' ||
    assessment.tier === 'institutional_directory'
  );
}

export function prefilterLaneAwareItems(items: RawContent[]): RawContent[] {
  return items.filter((item) => {
    if (item._lane === 'EVENT') return hasLikelyEventSignals(item) && !isLikelyStaleEventPage(item);
    if (item._lane === 'COMMUNITY') return hasLikelyCommunitySignals(item);
    if (item._lane === 'RESOURCE') return isLikelyTrustedResourceSource(item);
    return !isLikelyStaleEventPage(item);
  });
}

async function timePipelineStage<T>(
  result: PipelineRunResult,
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    const duration = Date.now() - startedAt;
    result.stageTimings = { ...(result.stageTimings ?? {}), [name]: duration };
    console.log(`[Pipeline] Stage timing: ${name} ${duration}ms`);
  }
}

/**
 * Run the full known-source-first pipeline.
 * No arguments needed - reads pipeline source config from the database.
 */
export async function runPipeline(
  triggeredBy = 'cron',
  scope?: PipelineRunScope,
): Promise<PipelineRunResult> {
  const start = Date.now();
  resetLlmStats();

  const result: PipelineRunResult = {
    regionsScanned: 0,
    sourcesProcessed: 0,
    itemsFetched: 0,
    itemsPassedFilter: 0,
    itemsExtracted: 0,
    itemsQueued: 0,
    itemsSkippedDuplicate: 0,
    itemsSkippedNoCity: 0,
    itemsSkippedPast: 0,
    errors: [],
    llmCalls: 0,
    llmTokensEstimate: 0,
    duration: 0,
    stageTimings: {},
    filterFailures: 0,
    extractRetriesExhausted: 0,
    itemsDroppedBadIndex: 0,
    budgetExceeded: false,
    circuitBreakerTripped: false,
    laneBreakdown: buildEmptyLaneBreakdown(),
    cityBreakdown: [],
  };

  const scopeRegionIds = Array.from(
    new Set((scope?.regionIds ?? []).map((id) => id.trim()).filter(Boolean)),
  );
  const scopeCitySlugs = Array.from(
    new Set((scope?.citySlugs ?? []).map((slug) => slug.trim()).filter(Boolean)),
  );

  // Create PipelineRun row UP-FRONT so we have an id to attribute per-LLM-call
  // audit rows to (PRD-0027). Counters are zero initially and patched on
  // completion via update().
  let pipelineRunId: string | null = null;
  try {
    const created = await db.pipelineRun.create({
      data: {
        triggeredBy,
        scopeRegionIds,
        scopeCitySlugs,
        regionsScanned: 0,
        sourcesProcessed: 0,
        itemsFetched: 0,
        itemsPassedFilter: 0,
        itemsExtracted: 0,
        itemsQueued: 0,
        itemsSkippedDuplicate: 0,
        itemsSkippedNoCity: 0,
        itemsSkippedPast: 0,
        llmCalls: 0,
        llmTokensEstimate: 0,
        durationMs: 0,
        errors: [],
      },
    });
    pipelineRunId = created.id;
  } catch (createErr) {
    console.error('[Pipeline] Failed to create up-front PipelineRun:', createErr);
  }

  const baseRegions = await getRuntimeEnabledRegions();
  const regions = filterRegionsByScope(baseRegions, scope);
  const scopedCitySlugs =
    scope && (scope.citySlugs?.length || scope.regionIds?.length)
      ? Array.from(new Set(regions.flatMap((region) => region.citySlugs)))
      : undefined;
  const scopedStates =
    scope && (scope.citySlugs?.length || scope.regionIds?.length)
      ? Array.from(
          new Set(
            regions
              .map((region) => region.state)
              .filter((state): state is string => Boolean(state)),
          ),
        )
      : undefined;
  if (regions.length === 0) {
    throw new Error(
      '[Pipeline] No regions matched the requested scope. Check --region/--city values or cron query params.',
    );
  }
  const uniqueRaw = await timePipelineStage(result, 'fetch', () =>
    fetchAllSources(regions, result, triggeredBy, scopedCitySlugs, scopedStates),
  );
  const candidateRaw = await timePipelineStage(result, 'prefilter', async () => {
    const currentItems = prefilterLikelyCurrentItems(uniqueRaw);
    const skippedCount = uniqueRaw.length - currentItems.length;
    if (skippedCount > 0) {
      console.log(
        `[Pipeline] Prefilter: kept ${currentItems.length}/${uniqueRaw.length}; skipped ${skippedCount} likely-stale event pages before LLM`,
      );
    }
    return currentItems;
  });

  if (candidateRaw.length > 0) {
    try {
      const relevantItems = pipelineRunId
        ? await withLlmContext({ runId: pipelineRunId, stage: 'filter' }, () =>
            timePipelineStage(result, 'filter', () => filterRelevantItems(candidateRaw, result)),
          )
        : await timePipelineStage(result, 'filter', () =>
            filterRelevantItems(candidateRaw, result),
          );

      const runExtract = async () =>
        timePipelineStage(result, 'extract', () => extractRelevantItems(relevantItems, result));
      const extracted =
        relevantItems.length > 0
          ? pipelineRunId
            ? await withLlmContext({ runId: pipelineRunId, stage: 'extract' }, runExtract)
            : await runExtract()
          : [];

      if (extracted.length > 0) {
        const runResolve = async () =>
          timePipelineStage(result, 'resolveQueue', () =>
            resolveAndQueue(extracted, relevantItems, regions, result),
          );
        // Semantic dedup inside resolveAndQueue may call LLM - tag stage='dedup'.
        if (pipelineRunId) {
          await withLlmContext({ runId: pipelineRunId, stage: 'dedup' }, runResolve);
        } else {
          await runResolve();
        }
      }
    } catch (guardErr) {
      // PRD/TDD-0028: budget or circuit guard tripped. Record it on the run
      // and let the persistence block below write whatever we already have.
      if (guardErr instanceof PipelineBudgetExceededError) {
        result.budgetExceeded = true;
        result.errors.push(`budget_exceeded:tokens=${guardErr.tokensConsumed}`);
        console.warn(
          `[Pipeline] budget exceeded (tokens=${guardErr.tokensConsumed} >= ${guardErr.limit}); halting LLM stages`,
        );
      } else if (guardErr instanceof PipelineCircuitOpenError) {
        result.circuitBreakerTripped = true;
        result.errors.push(
          `circuit_breaker_tripped:consecutive_failures=${guardErr.consecutiveFailures}`,
        );
        console.warn(
          `[Pipeline] circuit breaker tripped after ${guardErr.consecutiveFailures} consecutive failures; halting LLM stages`,
        );
      } else {
        throw guardErr;
      }
    }
  }

  const stats = getLlmStats();
  result.llmCalls = stats.calls;
  result.llmTokensEstimate = stats.tokensEstimate;
  result.filterFailures = stats.filterFailures;
  result.extractRetriesExhausted = stats.extractRetriesExhausted;
  result.itemsDroppedBadIndex = stats.itemsDroppedBadIndex;
  result.duration = Date.now() - start;

  // Persist run history for observability.
  // If the up-front row exists, patch it; otherwise create one (migration not yet applied path).
  try {
    if (pipelineRunId) {
      await db.pipelineRun.update({
        where: { id: pipelineRunId },
        data: {
          regionsScanned: result.regionsScanned,
          sourcesProcessed: result.sourcesProcessed,
          itemsFetched: result.itemsFetched,
          itemsPassedFilter: result.itemsPassedFilter,
          itemsExtracted: result.itemsExtracted,
          itemsQueued: result.itemsQueued,
          itemsSkippedDuplicate: result.itemsSkippedDuplicate,
          itemsSkippedNoCity: result.itemsSkippedNoCity,
          itemsSkippedPast: result.itemsSkippedPast,
          llmCalls: result.llmCalls,
          llmTokensEstimate: result.llmTokensEstimate,
          durationMs: result.duration,
          errors: result.errors,
          filterFailures: result.filterFailures,
          extractRetriesExhausted: result.extractRetriesExhausted,
          itemsDroppedBadIndex: result.itemsDroppedBadIndex,
          budgetExceeded: result.budgetExceeded,
          circuitBreakerTripped: result.circuitBreakerTripped,
          laneBreakdown: result.laneBreakdown as Prisma.InputJsonValue,
        },
      });
    } else {
      await db.pipelineRun.create({
        data: {
          triggeredBy,
          scopeRegionIds,
          scopeCitySlugs,
          regionsScanned: result.regionsScanned,
          sourcesProcessed: result.sourcesProcessed,
          itemsFetched: result.itemsFetched,
          itemsPassedFilter: result.itemsPassedFilter,
          itemsExtracted: result.itemsExtracted,
          itemsQueued: result.itemsQueued,
          itemsSkippedDuplicate: result.itemsSkippedDuplicate,
          itemsSkippedNoCity: result.itemsSkippedNoCity,
          itemsSkippedPast: result.itemsSkippedPast,
          llmCalls: result.llmCalls,
          llmTokensEstimate: result.llmTokensEstimate,
          durationMs: result.duration,
          errors: result.errors,
          filterFailures: result.filterFailures,
          extractRetriesExhausted: result.extractRetriesExhausted,
          itemsDroppedBadIndex: result.itemsDroppedBadIndex,
          budgetExceeded: result.budgetExceeded,
          circuitBreakerTripped: result.circuitBreakerTripped,
          laneBreakdown: result.laneBreakdown as Prisma.InputJsonValue,
        },
      });
    }
  } catch (persistErr) {
    console.error('[Pipeline] Failed to persist run history:', persistErr);
  }

  console.log(
    `[Pipeline] Done: ${result.itemsQueued} queued, ${result.itemsSkippedDuplicate} dupes, ${result.itemsSkippedNoCity} no-city, ${result.llmCalls} LLM calls (~${result.llmTokensEstimate} tokens) in ${result.duration}ms`,
  );
  console.log(
    `[Pipeline] Lane outcomes: fetched E/C/R/U=${result.laneBreakdown.EVENT.fetched}/${result.laneBreakdown.COMMUNITY.fetched}/${result.laneBreakdown.RESOURCE.fetched}/${result.laneBreakdown.UNKNOWN.fetched}; queued E/C/R=${result.laneBreakdown.EVENT.queued}/${result.laneBreakdown.COMMUNITY.queued}/${result.laneBreakdown.RESOURCE.queued}; dupes E/C/R=${result.laneBreakdown.EVENT.duplicates}/${result.laneBreakdown.COMMUNITY.duplicates}/${result.laneBreakdown.RESOURCE.duplicates}; no-city E/C/R=${result.laneBreakdown.EVENT.noCity}/${result.laneBreakdown.COMMUNITY.noCity}/${result.laneBreakdown.RESOURCE.noCity}; conflicts E/C/R=${result.laneBreakdown.EVENT.cityConflicts}/${result.laneBreakdown.COMMUNITY.cityConflicts}/${result.laneBreakdown.RESOURCE.cityConflicts}`,
  );

  return result;
}

// ─── Phase 1: Fetch ────────────────────────────────────

async function fetchAllSources(
  regions: Region[],
  result: PipelineRunResult,
  triggeredBy: string,
  scopedCitySlugs?: string[],
  scopedStates?: string[],
): Promise<RawContent[]> {
  const allRaw: RawContent[] = [];
  const sourcePlan = await buildPipelineSourcePlan(regions, triggeredBy);
  const scopedCitySet = new Set((scopedCitySlugs ?? []).map((slug) => slug.trim()).filter(Boolean));
  const scopedStateSet = new Set((scopedStates ?? []).map((state) => state.trim()).filter(Boolean));
  const pinnedStrategies =
    scopedCitySet.size > 0 || scopedStateSet.size > 0
      ? sourcePlan.pinnedStrategies.filter((strategy) => {
          const scope =
            strategy.scope ??
            (strategy.hintCitySlug ? 'CITY' : strategy.hintState ? 'REGION' : 'GENERIC');
          if (scope === 'CITY')
            return Boolean(strategy.hintCitySlug && scopedCitySet.has(strategy.hintCitySlug));
          if (scope === 'REGION')
            return Boolean(strategy.hintState && scopedStateSet.has(strategy.hintState));
          return false;
        })
      : sourcePlan.pinnedStrategies;

  if (scopedCitySet.size > 0 || scopedStateSet.size > 0) {
    console.log(
      `[Pipeline] Scoped run: pinned sources limited to ${pinnedStrategies.length}/${sourcePlan.pinnedStrategies.length} (cities=${[...scopedCitySet].join(', ') || 'none'}; states=${[...scopedStateSet].join(', ') || 'none'})`,
    );
  }

  for (const note of sourcePlan.notes) {
    console.log(`[Pipeline] Plan: ${note}`);
  }

  console.log(
    `[Pipeline] Regions: ${regions.length}, Keyword strategies: ${sourcePlan.keywordStrategies.length}, Pinned: ${sourcePlan.staticPinnedCount} static + ${sourcePlan.dbPinnedCount} DB = ${pinnedStrategies.length} total`,
  );

  // Pinned URLs - all run in parallel (each is an independent HTTP fetch)
  const pinnedOutcomes = await Promise.allSettled(
    pinnedStrategies.map(async (strategy) => {
      const fetchResult = await fetchPinnedUrl(strategy, triggeredBy);
      for (const item of fetchResult.items) {
        item._lane = strategy.lane;
        item._sourceIntent = strategy.sourceIntent;
        item._hintCitySlug = strategy.hintCitySlug;
        item._hintCommunityId = strategy.hintCommunityId;
        item._hintCommunityName = strategy.hintCommunityName;
      }
      console.log(`[Pipeline] ${strategy.id} → ${fetchResult.items.length} items`);
      return { strategy, fetchResult };
    }),
  );
  for (const outcome of pinnedOutcomes) {
    result.sourcesProcessed++;
    if (outcome.status === 'fulfilled') {
      allRaw.push(...outcome.value.fetchResult.items);
      result.errors.push(
        ...outcome.value.fetchResult.errors.map(
          (error) => `[${outcome.value.strategy.id}] ${outcome.value.strategy.label}: ${error}`,
        ),
      );
    } else {
      result.errors.push(String(outcome.reason));
    }
  }

  if (sourcePlan.keywordStrategies.length > 0) {
    // Keyword strategies × regions - all combinations run in parallel.
    // Avoids serial wait: 3 regions × 3 strategies × ~7s each ≈ 63s serial → ~7s parallel.
    const keywordJobs = regions.flatMap((region) =>
      sourcePlan.keywordStrategies.map((strategy) => async () => {
        let fetchResult;
        if (strategy.sourceType === 'GOOGLE_SEARCH') {
          fetchResult = await fetchGoogleSearch(strategy, region);
        } else if (strategy.sourceType === 'DUCKDUCKGO') {
          fetchResult = await fetchDuckDuckGoSearch(strategy, region);
        } else {
          fetchResult = await fetchEventbriteKeywords(strategy, region);
        }
        for (const item of fetchResult.items) {
          item._lane = strategy.lane;
          item._sourceIntent = strategy.sourceIntent;
        }
        console.log(`[Pipeline] ${strategy.id}:${region.id} → ${fetchResult.items.length} items`);
        return fetchResult;
      }),
    );

    const keywordOutcomes = await Promise.allSettled(keywordJobs.map((fn) => fn()));
    for (const outcome of keywordOutcomes) {
      result.sourcesProcessed++;
      if (outcome.status === 'fulfilled') {
        allRaw.push(...outcome.value.items);
        result.errors.push(...outcome.value.errors);
      } else {
        result.errors.push(String(outcome.reason));
      }
    }
  }

  result.regionsScanned = regions.length;

  result.itemsFetched = allRaw.length;
  for (const item of allRaw) {
    incrementLaneMetric(result.laneBreakdown, getLaneMetricKeyForRaw(item), 'fetched');
  }
  console.log(`[Pipeline] Total fetched: ${allRaw.length} raw items`);

  // Deduplicate by sourceUrl
  const seen = new Set<string>();
  const uniqueRaw = allRaw.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
  console.log(`[Pipeline] After URL dedup: ${uniqueRaw.length} unique items`);
  return uniqueRaw;
}

type ExtractedItem = ExtractedData & { sourceIndex: number };

function getExtractedItemLabel(item: ExtractedData): string {
  if (item.type === 'EVENT') return item.title;
  if (item.type === 'COMMUNITY') return item.name;
  return item.title;
}

// ─── Phase 2: Filter & Extract ─────────────────────────

async function filterRelevantItems(
  uniqueRaw: RawContent[],
  result: PipelineRunResult,
): Promise<RawContent[]> {
  console.log('[Pipeline] Stage 1: Relevance filter...');
  const prefiltered = prefilterLaneAwareItems(uniqueRaw);
  const deterministicDropped = uniqueRaw.length - prefiltered.length;
  if (deterministicDropped > 0) {
    console.log(`[Pipeline] Deterministic lane prefilter dropped ${deterministicDropped} items`);
  }

  const directCalendarItems = prefiltered.filter(isEmbeddedCalendarEventRawContent);
  const llmCandidates = prefiltered.filter((item) => !isEmbeddedCalendarEventRawContent(item));

  const relevanceResults = await filterRelevance(llmCandidates);
  const llmRelevantItems = relevanceResults
    .filter((r) => r.isRelevant)
    .map((r) => llmCandidates[r.index])
    .filter((item): item is RawContent => item != null);

  const relevantItems = [...directCalendarItems, ...llmRelevantItems];

  result.itemsPassedFilter = relevantItems.length;
  for (const item of relevantItems) {
    incrementLaneMetric(result.laneBreakdown, getLaneMetricKeyForRaw(item), 'passedFilter');
  }
  console.log(
    `[Pipeline] Passed filter: ${relevantItems.length}/${prefiltered.length} (from ${uniqueRaw.length} raw)`,
  );

  return relevantItems;
}

async function extractRelevantItems(
  relevantItems: RawContent[],
  result: PipelineRunResult,
): Promise<ExtractedItem[]> {
  console.log('[Pipeline] Stage 2: Batch extraction...');
  const directExtracted: ExtractedItem[] = [];
  const llmItems: RawContent[] = [];
  const llmSourceIndices: number[] = [];

  relevantItems.forEach((item, index) => {
    const calendarEvent = extractCalendarEventFromRawContent(item);
    if (calendarEvent) {
      directExtracted.push({ ...calendarEvent, sourceIndex: index });
      return;
    }

    llmItems.push(item);
    llmSourceIndices.push(index);
  });

  const llmExtracted = llmItems.length > 0 ? await extractBatch(llmItems) : [];

  const extracted = [
    ...directExtracted,
    ...llmExtracted.map((item) => ({
      ...item,
      sourceIndex: llmSourceIndices[item.sourceIndex] ?? item.sourceIndex,
    })),
  ];

  result.itemsExtracted = extracted.length;
  for (const item of extracted) {
    incrementLaneMetric(result.laneBreakdown, getLaneMetricKeyForExtracted(item), 'extracted');
  }
  const eventCount = extracted.filter((item) => item.type === 'EVENT').length;
  const communityCount = extracted.filter((item) => item.type === 'COMMUNITY').length;
  const resourceCount = extracted.filter((item) => item.type === 'RESOURCE').length;
  console.log(
    `[Pipeline] Extracted: ${extracted.length} structured items (${eventCount} events, ${communityCount} communities, ${resourceCount} resources)`,
  );

  return extracted;
}

// ─── Phase 3: Resolve, Dedup & Queue ───────────────────

async function resolveAndQueue(
  extracted: ExtractedItem[],
  relevantItems: RawContent[],
  regions: Region[],
  result: PipelineRunResult,
): Promise<void> {
  const allCitySlugs = regions.flatMap((r) => r.citySlugs);
  const hintedCitySlugs = [
    ...new Set(
      relevantItems
        .map((item) => item._hintCitySlug)
        .filter((slug): slug is string => typeof slug === 'string' && slug.trim().length > 0),
    ),
  ];
  const cityScopeSlugs = [...new Set([...allCitySlugs, ...hintedCitySlugs])];
  // Load region metros AND all their satellite cities so that communities
  // in satellite cities (e.g. esslingen → stuttgart metro) resolve correctly.
  // This avoids manually enumerating satellite slugs in source defaults.
  const cities = await db.city.findMany({
    where: {
      OR: [{ slug: { in: cityScopeSlugs } }, { metroRegion: { slug: { in: cityScopeSlugs } } }],
    },
    select: { id: true, slug: true, name: true },
  });
  const sourceReliabilityByKey = await getSourceReliabilityMap();
  const cityBySlug = new Map<string, { id: string; name: string }>();
  const cityById = new Map<string, { slug: string; name: string }>();

  for (const c of cities) {
    cityBySlug.set(c.slug, { id: c.id, name: c.name });
    cityById.set(c.id, { slug: c.slug, name: c.name });
  }

  const decisionCounts = {
    queuedEvents: 0,
    queuedCommunities: 0,
    queuedResources: 0,
    queuedPendingCityEvents: 0,
    queuedPendingCityCommunities: 0,
    queuedPendingCityResources: 0,
    duplicateEvents: 0,
    duplicateCommunities: 0,
    duplicateResources: 0,
    rejectedSuppressed: 0,
    noCityEvents: 0,
    noCityCommunities: 0,
    noCityResources: 0,
    pastEvents: 0,
  };

  const cityDecisionMap = new Map<
    string,
    {
      citySlug: string;
      cityName: string;
      extracted: number;
      queuedEvents: number;
      queuedCommunities: number;
      queuedResources: number;
      duplicateEvents: number;
      duplicateCommunities: number;
      duplicateResources: number;
      pastEvents: number;
    }
  >();

  function getCityDecisionCounter(cityId: string) {
    const existing = cityDecisionMap.get(cityId);
    if (existing) return existing;

    const city = cityById.get(cityId);
    const created = {
      citySlug: city?.slug ?? cityId,
      cityName: city?.name ?? cityId,
      extracted: 0,
      queuedEvents: 0,
      queuedCommunities: 0,
      queuedResources: 0,
      duplicateEvents: 0,
      duplicateCommunities: 0,
      duplicateResources: 0,
      pastEvents: 0,
    };
    cityDecisionMap.set(cityId, created);
    return created;
  }

  const fallbackCitySlug = process.env.PIPELINE_NO_CITY_FALLBACK_SLUG?.trim();
  const fallbackCity = fallbackCitySlug ? (cityBySlug.get(fallbackCitySlug) ?? null) : null;

  for (const item of extracted) {
    const sourceRaw = relevantItems[item.sourceIndex];
    if (!sourceRaw) continue;

    let cityId: string | null = null;
    let isCityPending = false;
    let cityConflict = false;
    let cityConflictReason: string | undefined;
    let cityResolutionSource: 'signal' | 'llm' | 'hint' | 'fallback' | 'unresolved' = 'unresolved';
    if (item.type === 'EVENT') {
      const resolution = resolveEventCityDecision(
        item,
        sourceRaw,
        cities,
        cityBySlug,
        fallbackCity,
        fallbackCitySlug,
      );
      cityId = resolution.cityId;
      isCityPending = resolution.isCityPending;
      cityConflict = resolution.cityConflict;
      cityConflictReason = resolution.cityConflictReason;
      cityResolutionSource = resolution.resolutionSource;
      if (isCityPending && fallbackCitySlug) {
        console.log(
          `[Pipeline] Pending city fallback: ${getExtractedItemLabel(item)} - cityName: ${item.cityName ?? 'n/a'} => ${fallbackCitySlug}`,
        );
      }
      if (cityConflict && cityConflictReason) {
        incrementLaneMetric(result.laneBreakdown, 'EVENT', 'cityConflicts');
        console.warn(`[Pipeline] ${cityConflictReason}`);
      }
    } else {
      if (item.cityName) {
        const match = resolveCityMatch(item.cityName, cities, CITY_NAME_ALIASES);
        if (match) {
          cityId = match.id;
          cityResolutionSource = 'llm';
        }
      }

      if (!cityId) {
        const hint = sourceRaw._hintCitySlug;
        if (hint) {
          const match = cityBySlug.get(hint);
          if (match) {
            cityId = match.id;
            cityResolutionSource = 'hint';
          }
        }
      }

      if (!cityId && fallbackCity && fallbackCitySlug) {
        cityId = fallbackCity.id;
        isCityPending = true;
        cityResolutionSource = 'fallback';
        console.log(
          `[Pipeline] Pending city fallback: ${getExtractedItemLabel(item)} - cityName: ${item.cityName ?? 'n/a'} => ${fallbackCitySlug}`,
        );
      }
    }

    if (!cityId) {
      result.itemsSkippedNoCity++;
      if (item.type === 'EVENT') {
        decisionCounts.noCityEvents++;
      } else if (item.type === 'COMMUNITY') {
        decisionCounts.noCityCommunities++;
      } else {
        decisionCounts.noCityResources++;
      }
      incrementLaneMetric(result.laneBreakdown, getLaneMetricKeyForExtracted(item), 'noCity');
      console.log(
        `[Pipeline] Skipped (no city): ${getExtractedItemLabel(item)} - cityName: ${item.cityName}`,
      );
      continue;
    }

    const cityCounter = getCityDecisionCounter(cityId);
    cityCounter.extracted++;

    // Skip events from before the current calendar year. Events from earlier
    // in the running year are still queued (they show as past on the public
    // site but give us visibility that the source is producing content).
    if (item.type === 'EVENT' && item.date) {
      const eventDate = new Date(`${item.date}T23:59:59`);
      const startOfCurrentYear = new Date(new Date().getFullYear(), 0, 1);
      if (!Number.isNaN(eventDate.getTime()) && eventDate < startOfCurrentYear) {
        result.itemsSkippedPast++;
        decisionCounts.pastEvents++;
        cityCounter.pastEvents++;
        incrementLaneMetric(result.laneBreakdown, 'EVENT', 'past');
        continue;
      }
    }

    // Dedup check
    const isDupe = await checkDuplicate(item, cityId, sourceRaw.sourceUrl);
    if (item.type === 'EVENT' && isDupe.isDuplicate) {
      if (isDupe.matchKind === 'PIPELINE_ITEM' && isDupe.matchedId) {
        await mergeIntoPendingEventPipelineItem(isDupe.matchedId, item, sourceRaw);
      }
      result.itemsSkippedDuplicate++;
      decisionCounts.duplicateEvents++;
      cityCounter.duplicateEvents++;
      incrementLaneMetric(result.laneBreakdown, 'EVENT', 'duplicates');
      continue;
    }

    if (isDupe.isDuplicate) {
      result.itemsSkippedDuplicate++;
      if (item.type === 'EVENT') {
        decisionCounts.duplicateEvents++;
        cityCounter.duplicateEvents++;
        incrementLaneMetric(result.laneBreakdown, 'EVENT', 'duplicates');
      } else if (item.type === 'COMMUNITY') {
        decisionCounts.duplicateCommunities++;
        cityCounter.duplicateCommunities++;
        incrementLaneMetric(result.laneBreakdown, 'COMMUNITY', 'duplicates');
      } else {
        decisionCounts.duplicateResources++;
        cityCounter.duplicateResources++;
        incrementLaneMetric(result.laneBreakdown, 'RESOURCE', 'duplicates');
      }
      continue;
    }

    // Rejection memory: an admin already turned this item down in a previous
    // run. Suppress it so we don't re-queue the same source/title/name every
    // day. This is checked AFTER the active-duplicate check (a still-pending or
    // approved match is preferred) but BEFORE we queue anything new.
    const rejectedMatch =
      item.type === 'EVENT'
        ? await findRejectedEventMatch({ event: item, cityId, sourceUrl: sourceRaw.sourceUrl })
        : item.type === 'COMMUNITY'
          ? await findRejectedCommunityMatch({
              community: item,
              cityId,
              sourceUrl: sourceRaw.sourceUrl,
            })
          : await findRejectedResourceMatch({
              resource: item,
              cityId,
              sourceUrl: sourceRaw.sourceUrl,
            });
    if (rejectedMatch) {
      // Counted under the duplicate bucket for run-history persistence (no new
      // schema column), but logged distinctly for diagnosis.
      result.itemsSkippedDuplicate++;
      decisionCounts.rejectedSuppressed++;
      console.log(
        `[Pipeline] Skipped (previously rejected: ${rejectedMatch.reason}): ${getExtractedItemLabel(item)}`,
      );
      continue;
    }

    const reliability = sourceReliabilityByKey.get(
      buildSourceReliabilityKey(sourceRaw.sourceType as PipelineSourceType, item.type),
    );
    const confidence = applySourceConfidenceAdjustment(
      item.confidence,
      reliability?.confidenceAdjustment ?? 0,
    );
    const resolvedCity = cityId
      ? (() => {
          const city = cityById.get(cityId);
          return city ? { id: cityId, name: city.name } : null;
        })()
      : null;
    const queuedItem =
      !item.cityName && resolvedCity ? { ...item, cityName: resolvedCity.name } : item;
    const resolutionProvenance = buildResolutionProvenance(
      queuedItem,
      sourceRaw,
      cityResolutionSource,
      cityConflict,
      isCityPending,
    );

    // Queue for review
    // Winston/ADR: RESOURCE lane is flag-gated. Drop resource items silently
    // when lane is not yet enabled so deployments can precede migration.
    if (queuedItem.type === 'RESOURCE' && !FLAGS.pipelineResourceLaneEnabled) {
      continue;
    }

    const createdItem = await db.pipelineItem.create({
      data: {
        entityType:
          queuedItem.type === 'EVENT'
            ? 'EVENT'
            : queuedItem.type === 'COMMUNITY'
              ? 'COMMUNITY'
              : 'RESOURCE',
        sourceType: sourceRaw.sourceType as import('@prisma/client').PipelineSourceType,
        sourceUrl: sourceRaw.sourceUrl,
        rawContent: sourceRaw.text.slice(0, 50_000),
        extractedData: queuedItem as unknown as import('@prisma/client').Prisma.InputJsonValue,
        confidence,
        cityId,
        matchedEntityId: isDupe.matchedId ?? undefined,
        matchScore: isDupe.matchScore ?? undefined,
        reviewNotes: isCityPending
          ? (cityConflictReason ??
            `CITY_PENDING: extracted city "${item.cityName ?? 'unknown'}" did not match configured cities; queued with fallback city "${fallbackCitySlug}" for admin review.`)
          : cityConflict
            ? cityConflictReason
            : undefined,
        metadata: {
          resolutionProvenance,
          ...(isCityPending || cityConflict
            ? {
                cityResolution: {
                  status: isCityPending ? 'PENDING' : 'CORRECTED',
                  source: cityResolutionSource,
                  extractedCityName: item.cityName ?? null,
                  fallbackCitySlug: isCityPending ? fallbackCitySlug : null,
                  reason: isCityPending
                    ? (cityConflictReason ?? 'No city match found in configured cities/aliases.')
                    : (cityConflictReason ?? 'City conflict corrected from event signals.'),
                },
              }
            : {}),
          ...(sourceRaw._hintCommunityId || sourceRaw._hintCommunityName
            ? {
                sourceHints: {
                  communityId: sourceRaw._hintCommunityId ?? null,
                  communityName: sourceRaw._hintCommunityName ?? null,
                  citySlug: sourceRaw._hintCitySlug ?? null,
                },
              }
            : {}),
          ...(() => {
            // PRD/TDD-0053: suggest persona segments for communities (suggest-only;
            // applied on human approval). Inert unless JOURNEY_TAG_SUGGESTIONS_ENABLED.
            if (!FLAGS.journeyTagSuggestionsEnabled || queuedItem.type !== 'COMMUNITY') return {};
            const personaSegments = suggestCommunityPersonaSegments({
              name: queuedItem.name,
              description: queuedItem.description,
              categories: queuedItem.categories,
            });
            return personaSegments.length > 0 ? { suggestedTags: { personaSegments } } : {};
          })(),
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    result.itemsQueued++;
    if (queuedItem.type === 'EVENT') {
      decisionCounts.queuedEvents++;
      cityCounter.queuedEvents++;
      if (isCityPending) decisionCounts.queuedPendingCityEvents++;
      incrementLaneMetric(result.laneBreakdown, 'EVENT', 'queued');
    } else if (queuedItem.type === 'COMMUNITY') {
      decisionCounts.queuedCommunities++;
      cityCounter.queuedCommunities++;
      if (isCityPending) decisionCounts.queuedPendingCityCommunities++;
      incrementLaneMetric(result.laneBreakdown, 'COMMUNITY', 'queued');
    } else {
      decisionCounts.queuedResources++;
      cityCounter.queuedResources++;
      if (isCityPending) decisionCounts.queuedPendingCityResources++;
      incrementLaneMetric(result.laneBreakdown, 'RESOURCE', 'queued');
    }

    const autoApprove =
      queuedItem.type === 'EVENT'
        ? sourceRaw.sourceType === 'DB_COMMUNITY' &&
          !isCityPending &&
          !cityConflict &&
          resolutionProvenance.resolutionConfidence >= 0.85
          ? { eligible: true, reason: 'trusted-db-community-event' }
          : { eligible: false, reason: 'event-admin-approval-required' }
        : shouldAutoApprovePipelineItem({
            item: { ...queuedItem, confidence },
            sourceType: sourceRaw.sourceType as PipelineSourceType,
            reliability,
            matchedEntityId: isDupe.matchedId,
            matchScore: isDupe.matchScore,
            resolutionProvenance,
          });
    if (autoApprove.eligible && !isCityPending && !cityConflict) {
      await approvePipelineItemRecord(createdItem.id, {
        reviewedBy: 'system',
        autoApproved: true,
        autoApprovalReason: autoApprove.reason,
      });
    }
  }

  console.log(
    `[Pipeline] Queue decisions: queued ${decisionCounts.queuedEvents} events/${decisionCounts.queuedCommunities} communities/${decisionCounts.queuedResources} resources (city-pending ${decisionCounts.queuedPendingCityEvents} events/${decisionCounts.queuedPendingCityCommunities} communities/${decisionCounts.queuedPendingCityResources} resources); duplicates ${decisionCounts.duplicateEvents} events/${decisionCounts.duplicateCommunities} communities/${decisionCounts.duplicateResources} resources; previously-rejected suppressed ${decisionCounts.rejectedSuppressed}; no-city ${decisionCounts.noCityEvents} events/${decisionCounts.noCityCommunities} communities/${decisionCounts.noCityResources} resources; past events ${decisionCounts.pastEvents}`,
  );

  result.cityBreakdown = [...cityDecisionMap.values()].sort((a, b) => {
    const queuedDelta =
      b.queuedEvents +
      b.queuedCommunities +
      b.queuedResources -
      (a.queuedEvents + a.queuedCommunities + a.queuedResources);
    if (queuedDelta !== 0) return queuedDelta;
    return b.extracted - a.extracted;
  });
}

// ─── Deduplication ─────────────────────────────────────

type DedupResult = {
  isDuplicate: boolean;
  matchedId: string | null;
  matchScore: number | null;
  matchKind: 'PIPELINE_ITEM' | 'ENTITY' | null;
};

async function checkDuplicate(
  item: ExtractedData,
  cityId: string,
  sourceUrl: string,
): Promise<DedupResult> {
  const existingQueueItem = await checkSourceUrlDuplicate(sourceUrl, cityId, item.type);
  if (existingQueueItem.isDuplicate) return existingQueueItem;

  if (item.type === 'EVENT') {
    return checkEventDuplicate(item, cityId);
  }

  if (item.type === 'RESOURCE') {
    return checkResourceDuplicate(item, cityId);
  }

  return checkCommunityDuplicate(item, cityId);
}

async function checkSourceUrlDuplicate(
  sourceUrl: string,
  cityId: string,
  itemType: ExtractedData['type'],
): Promise<DedupResult> {
  const entityType =
    itemType === 'EVENT' ? 'EVENT' : itemType === 'COMMUNITY' ? 'COMMUNITY' : 'RESOURCE';
  const existingQueueItem = await db.pipelineItem.findFirst({
    where: {
      sourceUrl,
      cityId,
      entityType,
      status: { in: [...DEDUP_ACTIVE_STATUSES] },
    },
    select: { id: true },
  });

  if (existingQueueItem) {
    return {
      isDuplicate: true,
      matchedId: existingQueueItem.id,
      matchScore: 1.0,
      matchKind: 'PIPELINE_ITEM',
    };
  }

  const normalizedIncoming = normalizeSourceUrlForDedup(sourceUrl);
  if (!normalizedIncoming) {
    return {
      isDuplicate: false,
      matchedId: null,
      matchScore: null,
      matchKind: null,
    };
  }

  const recentQueueItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType,
      status: { in: [...DEDUP_ACTIVE_STATUSES] },
      sourceUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: DEDUP_QUEUE_SCAN_LIMIT,
    select: { id: true, sourceUrl: true },
  });

  for (const candidate of recentQueueItems) {
    if (normalizeSourceUrlForDedup(candidate.sourceUrl) === normalizedIncoming) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: 1.0,
        matchKind: 'PIPELINE_ITEM',
      };
    }
  }

  return {
    isDuplicate: false,
    matchedId: null,
    matchScore: null,
    matchKind: null,
  };
}

function hasHyphenBoundedToken(haystack: string, token: string): boolean {
  return (
    haystack === token ||
    haystack.startsWith(`${token}-`) ||
    haystack.endsWith(`-${token}`) ||
    haystack.includes(`-${token}-`)
  );
}

function findCitiesMentionedInText(
  text: string | null | undefined,
  cities: Array<{ id: string; slug: string; name: string }>,
  aliases: Record<string, string>,
): Array<{ id: string; slug: string; name: string }> {
  if (!text) return [];

  const normalized = normalizeCityLookupKey(text);
  if (!normalized) return [];

  const bySlug = new Map(cities.map((city) => [city.slug, city]));
  const keysToSlug = new Map<string, string>();

  for (const city of cities) {
    keysToSlug.set(normalizeCityLookupKey(city.name), city.slug);
    keysToSlug.set(normalizeCityLookupKey(city.slug), city.slug);
  }
  for (const [aliasKey, slug] of Object.entries(aliases)) {
    keysToSlug.set(aliasKey, slug);
  }

  const found = new Map<string, { id: string; slug: string; name: string }>();
  for (const [key, slug] of keysToSlug.entries()) {
    if (!key || !hasHyphenBoundedToken(normalized, key)) continue;
    const city = bySlug.get(slug);
    if (city) found.set(city.id, city);
  }

  return [...found.values()];
}

type EventSignalCitySummary = {
  city: { id: string; slug: string; name: string } | null;
  ambiguous: boolean;
};

function summarizeEventSignalCities(
  event: ExtractedEvent,
  cities: Array<{ id: string; slug: string; name: string }>,
): EventSignalCitySummary {
  const signalTexts = [event.venueAddress, event.venueName, event.hostCommunity, event.title];
  const found = new Map<string, { id: string; slug: string; name: string }>();

  for (const signal of signalTexts) {
    for (const city of findCitiesMentionedInText(signal, cities, CITY_NAME_ALIASES)) {
      found.set(city.id, city);
    }
  }

  if (found.size === 1) {
    return { city: [...found.values()][0] ?? null, ambiguous: false };
  }
  if (found.size > 1) {
    return { city: null, ambiguous: true };
  }
  return { city: null, ambiguous: false };
}

type EventCityResolution = {
  cityId: string | null;
  isCityPending: boolean;
  cityConflict: boolean;
  cityConflictReason?: string;
  resolutionSource: 'signal' | 'llm' | 'hint' | 'fallback' | 'unresolved';
};

function doesEventHostAgreeWithHint(event: ExtractedEvent, hintedCommunityName?: string): boolean {
  if (!event.hostCommunity) return true;
  if (!hintedCommunityName) return false;

  const normalizedHost = normalizeCommunityName(event.hostCommunity);
  const normalizedHint = normalizeCommunityName(hintedCommunityName);
  if (!normalizedHost || !normalizedHint) return false;
  return (
    normalizedHost === normalizedHint ||
    normalizedHost.includes(normalizedHint) ||
    normalizedHint.includes(normalizedHost)
  );
}

function buildResolutionProvenance(
  item: ExtractedData,
  sourceRaw: RawContent,
  citySource: ResolutionProvenance['citySource'],
  cityConflict: boolean,
  isCityPending: boolean,
): ResolutionProvenance {
  let communitySource: ResolutionProvenance['communitySource'] = 'unattached';
  if (
    item.type === 'EVENT' &&
    (sourceRaw._hintCommunityId || sourceRaw._hintCommunityName) &&
    doesEventHostAgreeWithHint(item, sourceRaw._hintCommunityName)
  ) {
    communitySource = 'hint';
  }

  let resolutionConfidence =
    citySource === 'signal'
      ? 0.98
      : citySource === 'llm'
        ? 0.88
        : citySource === 'hint'
          ? 0.82
          : citySource === 'fallback'
            ? 0.45
            : 0.2;

  if (cityConflict) resolutionConfidence -= 0.2;
  if (isCityPending) resolutionConfidence = Math.min(resolutionConfidence, 0.45);
  if (item.type === 'EVENT' && item.hostCommunity && communitySource === 'unattached') {
    resolutionConfidence -= 0.1;
  }

  return {
    citySource,
    cityConflict,
    communitySource,
    resolutionConfidence: Math.max(0, Math.min(1, resolutionConfidence)),
  };
}

export function resolveEventCityDecision(
  event: ExtractedEvent,
  sourceRaw: RawContent,
  cities: Array<{ id: string; slug: string; name: string }>,
  cityBySlug: Map<string, { id: string; name: string }>,
  fallbackCity: { id: string; name: string } | null,
  fallbackCitySlug?: string,
): EventCityResolution {
  const llmMatch = event.cityName
    ? resolveCityMatch(event.cityName, cities, CITY_NAME_ALIASES)
    : null;
  const hintedCity = sourceRaw._hintCitySlug
    ? (cityBySlug.get(sourceRaw._hintCitySlug) ?? null)
    : null;
  const signalSummary = summarizeEventSignalCities(event, cities);

  if (signalSummary.ambiguous) {
    if (fallbackCity && fallbackCitySlug) {
      return {
        cityId: fallbackCity.id,
        isCityPending: true,
        cityConflict: false,
        cityConflictReason: `City conflict: multiple city signals found for event "${event.title}"; queued with fallback city "${fallbackCitySlug}" for review.`,
        resolutionSource: 'fallback',
      };
    }
    return {
      cityId: null,
      isCityPending: false,
      cityConflict: false,
      cityConflictReason: `City conflict: multiple city signals found for event "${event.title}".`,
      resolutionSource: 'unresolved',
    };
  }

  if (signalSummary.city) {
    const llmConflict = llmMatch && llmMatch.id !== signalSummary.city.id;
    return {
      cityId: signalSummary.city.id,
      isCityPending: false,
      cityConflict: Boolean(llmConflict),
      cityConflictReason: llmConflict
        ? `City conflict: LLM city "${event.cityName ?? 'unknown'}" disagreed with event location signals; assigned "${signalSummary.city.name}".`
        : undefined,
      resolutionSource: 'signal',
    };
  }

  if (llmMatch) {
    return {
      cityId: llmMatch.id,
      isCityPending: false,
      cityConflict: false,
      resolutionSource: 'llm',
    };
  }

  if (
    hintedCity &&
    (!event.isOnline || doesEventHostAgreeWithHint(event, sourceRaw._hintCommunityName))
  ) {
    return {
      cityId: hintedCity.id,
      isCityPending: false,
      cityConflict: false,
      resolutionSource: 'hint',
    };
  }

  if (fallbackCity && fallbackCitySlug) {
    return {
      cityId: fallbackCity.id,
      isCityPending: true,
      cityConflict: false,
      cityConflictReason: `CITY_PENDING: extracted city "${event.cityName ?? 'unknown'}" did not match configured cities; queued with fallback city "${fallbackCitySlug}" for admin review.`,
      resolutionSource: 'fallback',
    };
  }

  return {
    cityId: null,
    isCityPending: false,
    cityConflict: false,
    resolutionSource: 'unresolved',
  };
}

function inferCityFromEventSignals(
  event: ExtractedEvent,
  cities: Array<{ id: string; slug: string; name: string }>,
): { id: string; slug: string; name: string } | null {
  return summarizeEventSignalCities(event, cities).city;
}

async function checkEventDuplicate(event: ExtractedEvent, cityId: string): Promise<DedupResult> {
  if (!event.date) {
    return { isDuplicate: false, matchedId: null, matchScore: null, matchKind: null };
  }

  const eventDate = new Date(event.date + 'T12:00:00');
  const startOfWindow = new Date(eventDate);
  startOfWindow.setDate(startOfWindow.getDate() - 1);
  startOfWindow.setHours(0, 0, 0, 0);
  const endOfWindow = new Date(eventDate);
  endOfWindow.setDate(endOfWindow.getDate() + 1);
  endOfWindow.setHours(23, 59, 59, 999);

  const candidates = await db.event.findMany({
    where: {
      cityId,
      startsAt: { gte: startOfWindow, lte: endOfWindow },
    },
    select: {
      id: true,
      title: true,
      registrationUrl: true,
      startsAt: true,
      venueName: true,
      community: { select: { name: true } },
    },
  });

  const incomingRegistrationUrl = normalizeComparableUrl(event.registrationUrl);

  for (const candidate of candidates) {
    const candidateRegistrationUrl = normalizeComparableUrl(candidate.registrationUrl);
    if (
      incomingRegistrationUrl &&
      candidateRegistrationUrl &&
      incomingRegistrationUrl === candidateRegistrationUrl
    ) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: 1, matchKind: 'ENTITY' };
    }

    const score = computeSimilarity(event.title.toLowerCase(), candidate.title.toLowerCase());
    if (
      isEventTitleMatch(event.title, candidate.title) &&
      hasStrongEventIdentityEvidence(
        {
          date: event.date,
          time: event.time,
          venueName: event.venueName,
          hostCommunity: event.hostCommunity,
        },
        {
          date: candidate.startsAt.toISOString().slice(0, 10),
          time: candidate.startsAt.toISOString().slice(11, 16),
          venueName: candidate.venueName,
          hostCommunity: candidate.community?.name ?? null,
        },
      )
    ) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: score, matchKind: 'ENTITY' };
    }
  }

  const pendingItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'EVENT',
      status: { in: [...DEDUP_ACTIVE_STATUSES] },
    },
    select: { id: true, extractedData: true },
  });

  for (const candidate of pendingItems) {
    const pendingEvent = candidate.extractedData as unknown as Partial<ExtractedEvent>;
    if (!pendingEvent.title || !pendingEvent.date) continue;

    const candidateDate = new Date(`${pendingEvent.date}T12:00:00`);
    if (Number.isNaN(candidateDate.getTime())) continue;
    const dayDiff = Math.abs(eventDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff > EVENT_DATE_WINDOW_DAYS) continue;

    const pendingRegistrationUrl = normalizeComparableUrl(pendingEvent.registrationUrl ?? null);
    if (
      incomingRegistrationUrl &&
      pendingRegistrationUrl &&
      incomingRegistrationUrl === pendingRegistrationUrl
    ) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: 1,
        matchKind: 'PIPELINE_ITEM',
      };
    }

    const score = computeSimilarity(event.title.toLowerCase(), pendingEvent.title.toLowerCase());
    if (
      isEventTitleMatch(event.title, pendingEvent.title) &&
      hasStrongEventIdentityEvidence(
        {
          date: event.date,
          time: event.time,
          venueName: event.venueName,
          hostCommunity: event.hostCommunity,
        },
        {
          date: pendingEvent.date,
          time: pendingEvent.time,
          venueName: pendingEvent.venueName,
          hostCommunity: pendingEvent.hostCommunity,
        },
      )
    ) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: score,
        matchKind: 'PIPELINE_ITEM',
      };
    }
  }

  return { isDuplicate: false, matchedId: null, matchScore: null, matchKind: null };
}

async function checkCommunityDuplicate(
  community: ExtractedData & { type: 'COMMUNITY' },
  cityId: string,
): Promise<DedupResult> {
  const candidates = await db.community.findMany({
    where: { cityId, mergedIntoId: null },
    select: { id: true, name: true, description: true, city: { select: { name: true } } },
  });

  const borderlineCandidates: Array<{
    id: string;
    name: string;
    description: string | null;
    cityName: string;
  }> = [];

  // Normalized incoming name (umlauts folded, legal suffixes stripped) reused
  // across the live, merged-alias, and pending comparisons below.
  const normalizedIncomingName = normalizeCommunityName(community.name);

  for (const candidate of candidates) {
    const score = computeSimilarity(normalizedIncomingName, normalizeCommunityName(candidate.name));
    if (isCommunityNameMatch(community.name, candidate.name)) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: score, matchKind: 'ENTITY' };
    }
    if (score >= COMMUNITY_DUPLICATE_SEMANTIC_THRESHOLD) {
      borderlineCandidates.push({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        cityName: candidate.city.name,
      });
    }
  }

  const semanticMatch = await (() => {
    const ctx = currentLlmContext();
    if (!ctx) {
      return semanticCommunityDuplicateCheck(community, borderlineCandidates.slice(0, 5));
    }
    return withLlmContext({ ...ctx, lane: 'COMMUNITY' }, () =>
      semanticCommunityDuplicateCheck(community, borderlineCandidates.slice(0, 5)),
    );
  })();
  if (semanticMatch) {
    return {
      isDuplicate: true,
      matchedId: semanticMatch.matchedId,
      matchScore: semanticMatch.confidence,
      matchKind: 'ENTITY',
    };
  }

  // Also treat merged/inactive aliases as duplicates, mapped to their
  // canonical target. This prevents repeatedly re-queuing names that were
  // already merged (e.g. legal-name variants ending in e.V.).
  const mergedAliases = await db.community.findMany({
    where: { cityId, mergedIntoId: { not: null } },
    select: { name: true, mergedIntoId: true },
  });

  for (const alias of mergedAliases) {
    if (alias.mergedIntoId && isCommunityNameMatch(community.name, alias.name)) {
      return {
        isDuplicate: true,
        matchedId: alias.mergedIntoId,
        matchScore: computeSimilarity(normalizedIncomingName, normalizeCommunityName(alias.name)),
        matchKind: 'ENTITY',
      };
    }
  }

  const pendingCommunityItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'COMMUNITY',
      status: { in: [...DEDUP_ACTIVE_STATUSES] },
    },
    select: { id: true, extractedData: true },
  });

  for (const pending of pendingCommunityItems) {
    const pendingCommunity = pending.extractedData as unknown as Partial<ExtractedData>;
    if (pendingCommunity.type !== 'COMMUNITY' || !pendingCommunity.name) continue;

    if (isCommunityNameMatch(community.name, String(pendingCommunity.name))) {
      return {
        isDuplicate: true,
        matchedId: pending.id,
        matchScore: computeSimilarity(
          normalizedIncomingName,
          normalizeCommunityName(String(pendingCommunity.name)),
        ),
        matchKind: 'PIPELINE_ITEM',
      };
    }
  }

  return { isDuplicate: false, matchedId: null, matchScore: null, matchKind: null };
}

function normalizeScopeForDedup(value: string | null | undefined): string {
  return (value ?? 'CITY').toUpperCase();
}

function normalizeScopeRegionForDedup(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  return v && v.length > 0 ? v : null;
}

function isResourceScopeCompatible(
  incoming: { scope: string | null; scopeRegion: string | null },
  candidate: { scope: string | null; scopeRegion: string | null },
): boolean {
  const incomingScope = normalizeScopeForDedup(incoming.scope);
  const candidateScope = normalizeScopeForDedup(candidate.scope);
  if (incomingScope !== candidateScope) return false;

  if (incomingScope === 'GLOBAL') return true;

  const incomingRegion = normalizeScopeRegionForDedup(incoming.scopeRegion);
  const candidateRegion = normalizeScopeRegionForDedup(candidate.scopeRegion);
  return incomingRegion === candidateRegion;
}

async function checkResourceDuplicate(
  resource: ExtractedResource,
  cityId: string,
): Promise<DedupResult> {
  const incomingUrl = normalizeComparableUrl(resource.url);
  const normalizedTitle = normalizeCommunityName(resource.title);
  const incomingScope = resource.scope ?? 'CITY';
  const incomingScopeRegion = resource.scopeRegion ?? null;

  const resourceCandidates = await db.resource.findMany({
    where: {
      OR: [{ cityId }, { scope: { in: ['COUNTRY', 'GLOBAL', 'STATE', 'METRO', 'DISTRICT'] } }],
      isHidden: false,
    },
    select: {
      id: true,
      title: true,
      url: true,
      resourceType: true,
      scope: true,
      scopeRegion: true,
    },
    take: DEDUP_QUEUE_SCAN_LIMIT,
  });

  for (const candidate of resourceCandidates) {
    if (
      !isResourceScopeCompatible(
        { scope: incomingScope, scopeRegion: incomingScopeRegion },
        { scope: candidate.scope, scopeRegion: candidate.scopeRegion },
      )
    ) {
      continue;
    }

    const candidateUrl = normalizeComparableUrl(candidate.url);
    if (incomingUrl && candidateUrl && incomingUrl === candidateUrl) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: 1, matchKind: 'ENTITY' };
    }

    const titleScore = computeSimilarity(normalizedTitle, normalizeCommunityName(candidate.title));
    if (
      titleScore >= 0.72 &&
      (!resource.resourceType || resource.resourceType === candidate.resourceType)
    ) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: titleScore,
        matchKind: 'ENTITY',
      };
    }
  }

  const pendingItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'RESOURCE',
      status: { in: [...DEDUP_ACTIVE_STATUSES] },
    },
    select: { id: true, extractedData: true },
    take: DEDUP_QUEUE_SCAN_LIMIT,
  });

  for (const candidate of pendingItems) {
    const pending = candidate.extractedData as unknown as Partial<ExtractedResource>;
    if (!pending.title) continue;

    if (
      !isResourceScopeCompatible(
        { scope: incomingScope, scopeRegion: incomingScopeRegion },
        { scope: pending.scope ?? null, scopeRegion: pending.scopeRegion ?? null },
      )
    ) {
      continue;
    }

    const pendingUrl = normalizeComparableUrl(pending.url ?? null);
    if (incomingUrl && pendingUrl && incomingUrl === pendingUrl) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: 1,
        matchKind: 'PIPELINE_ITEM',
      };
    }

    const titleScore = computeSimilarity(normalizedTitle, normalizeCommunityName(pending.title));
    if (titleScore >= 0.72) {
      return {
        isDuplicate: true,
        matchedId: candidate.id,
        matchScore: titleScore,
        matchKind: 'PIPELINE_ITEM',
      };
    }
  }

  return { isDuplicate: false, matchedId: null, matchScore: null, matchKind: null };
}

async function mergeIntoPendingEventPipelineItem(
  pipelineItemId: string,
  incomingEvent: ExtractedEvent,
  sourceRaw: RawContent,
): Promise<void> {
  const existingItem = await db.pipelineItem.findUnique({
    where: { id: pipelineItemId },
    select: { extractedData: true, rawContent: true, confidence: true },
  });
  if (!existingItem) return;

  const existingEvent = existingItem.extractedData as unknown as ExtractedEvent;
  const mergedEvent = mergeExtractedEvents(existingEvent, incomingEvent);
  const mergedConfidence = Math.max(existingItem.confidence, incomingEvent.confidence);
  const mergedRawContent = [
    existingItem.rawContent,
    `\n\n--- MERGED SOURCE (${sourceRaw.sourceType}) ${sourceRaw.sourceUrl} ---\n${sourceRaw.text.slice(0, 10_000)}`,
  ]
    .filter(Boolean)
    .join('');

  await db.pipelineItem.update({
    where: { id: pipelineItemId },
    data: {
      extractedData: mergedEvent as unknown as Prisma.InputJsonValue,
      confidence: mergedConfidence,
      rawContent: mergedRawContent,
      status: 'PENDING',
    },
  });
}

function mergeExtractedEvents(base: ExtractedEvent, incoming: ExtractedEvent): ExtractedEvent {
  const mergedFieldConfidence: Record<string, number> = {
    ...base.fieldConfidence,
    ...incoming.fieldConfidence,
  };

  const chooseField = <T>(field: keyof ExtractedEvent, baseValue: T, incomingValue: T): T => {
    const baseConfidence = base.fieldConfidence[field as string] ?? 0;
    const incomingConfidence = incoming.fieldConfidence[field as string] ?? 0;

    if (incomingValue == null || incomingValue === '' || incomingValue === false) {
      return baseValue;
    }
    if (baseValue == null || baseValue === '' || baseValue === false) {
      return incomingValue;
    }
    return incomingConfidence >= baseConfidence ? incomingValue : baseValue;
  };

  return {
    ...base,
    title: chooseField('title', base.title, incoming.title),
    description: chooseField('description', base.description, incoming.description),
    date: chooseField('date', base.date, incoming.date),
    time: chooseField('time', base.time, incoming.time),
    endDate: chooseField('endDate', base.endDate, incoming.endDate),
    endTime: chooseField('endTime', base.endTime, incoming.endTime),
    venueName: chooseField('venueName', base.venueName, incoming.venueName),
    venueAddress: chooseField('venueAddress', base.venueAddress, incoming.venueAddress),
    cityName: chooseField('cityName', base.cityName, incoming.cityName),
    isOnline: chooseField('isOnline', base.isOnline, incoming.isOnline),
    isFree: chooseField('isFree', base.isFree, incoming.isFree),
    cost: chooseField('cost', base.cost, incoming.cost),
    costType: chooseField('costType', base.costType, incoming.costType),
    priceAmount: chooseField('priceAmount', base.priceAmount, incoming.priceAmount),
    priceCurrency: chooseField('priceCurrency', base.priceCurrency, incoming.priceCurrency),
    costNote: chooseField('costNote', base.costNote, incoming.costNote),
    accessType: chooseField('accessType', base.accessType, incoming.accessType),
    requiresRegistration: chooseField(
      'requiresRegistration',
      base.requiresRegistration,
      incoming.requiresRegistration,
    ),
    requiresApproval: chooseField(
      'requiresApproval',
      base.requiresApproval,
      incoming.requiresApproval,
    ),
    entryNote: chooseField('entryNote', base.entryNote, incoming.entryNote),
    registrationUrl: chooseField('registrationUrl', base.registrationUrl, incoming.registrationUrl),
    imageUrl: chooseField('imageUrl', base.imageUrl, incoming.imageUrl),
    hostCommunity: chooseField('hostCommunity', base.hostCommunity, incoming.hostCommunity),
    categories: [...new Set([...base.categories, ...incoming.categories])],
    languages: [...new Set([...base.languages, ...incoming.languages])],
    confidence: Math.max(base.confidence, incoming.confidence),
    fieldConfidence: mergedFieldConfidence,
  };
}

/**
 * Simple string similarity (Dice coefficient on bigrams).
 * Good enough for dedup - not a full fuzzy match.
 */
