/**
 * Pipeline orchestrator — known-source-first content discovery pipeline.
 *
 * Flow:
 *   1. PLAN — DB + pinned sources first, keyword search only for DB coverage gaps
 *   2. FETCH — execute planned pinned URLs, then planned keyword searches
 *   3. FILTER — Stage 1 LLM: cheap batch relevance check
 *   4. EXTRACT — Stage 2 LLM: structured extraction with city assignment
 *   5. RESOLVE — map LLM cityName → DB city ID
 *   6. DEDUP — semantic/name similarity check against existing DB entities + queue
 *   7. QUEUE — store in PipelineItem for admin review
 *
 * Adding a new country: add region + strategy defaults in source-defaults.json,
 * sync them into DB, and rerun the pipeline. No orchestrator changes needed.
 */

import { db } from '@/lib/db';
import { Prisma, type PipelineSourceType } from '@prisma/client';
import { CITY_NAME_ALIASES } from '@/lib/config/cities';
import { normalizeCityLookupKey, resolveCityMatch } from '@/lib/city-resolution';
import { getRuntimeEnabledRegions } from './runtime-config';
import {
  fetchEventbriteKeywords,
  fetchPinnedUrl,
  fetchGoogleSearch,
  fetchDuckDuckGoSearch,
} from './sources';
import { scorePinnedEventUrl } from './db-sources';
import {
  STALE_EVENT_MARKERS,
  EVENT_PAGE_MARKERS,
  FRESH_EVENT_MARKERS,
  extractMentionedYears,
} from './freshness';
import { buildPipelineSourcePlan } from './source-plan';
import { filterRelevance, extractBatch, resetLlmStats, getLlmStats } from './extraction';
import { applySourceConfidenceAdjustment, getSourceReliabilityMap } from './reliability';
import { semanticCommunityDuplicateCheck } from './intelligence';
import { shouldAutoApprovePipelineItem, approvePipelineItemRecord } from './review';
import type {
  ExtractedData,
  ExtractedEvent,
  RawContent,
  PipelineRunResult,
  SearchRegion,
} from './types';

// Re-export PipelineRunResult type from types.ts
export type { PipelineRunResult } from './types';

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
 * No arguments needed — reads pipeline source config from the database.
 */
export async function runPipeline(triggeredBy = 'cron'): Promise<PipelineRunResult> {
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
  };

  const regions = await getRuntimeEnabledRegions();
  const uniqueRaw = await timePipelineStage(result, 'fetch', () =>
    fetchAllSources(regions, result, triggeredBy),
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
    const relevantItems = await timePipelineStage(result, 'filter', () =>
      filterRelevantItems(candidateRaw, result),
    );

    const extracted =
      relevantItems.length > 0
        ? await timePipelineStage(result, 'extract', () =>
            extractRelevantItems(relevantItems, result),
          )
        : [];

    if (extracted.length > 0) {
      await timePipelineStage(result, 'resolveQueue', () =>
        resolveAndQueue(extracted, relevantItems, regions, result),
      );
    }
  }

  const stats = getLlmStats();
  result.llmCalls = stats.calls;
  result.llmTokensEstimate = stats.tokensEstimate;
  result.duration = Date.now() - start;

  // Persist run history for observability
  try {
    await db.pipelineRun.create({
      data: {
        triggeredBy,
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
      },
    });
  } catch (persistErr) {
    console.error('[Pipeline] Failed to persist run history:', persistErr);
  }

  console.log(
    `[Pipeline] Done: ${result.itemsQueued} queued, ${result.itemsSkippedDuplicate} dupes, ${result.itemsSkippedNoCity} no-city, ${result.llmCalls} LLM calls (~${result.llmTokensEstimate} tokens) in ${result.duration}ms`,
  );

  return result;
}

// ─── Phase 1: Fetch ────────────────────────────────────

type Region = SearchRegion;

async function fetchAllSources(
  regions: Region[],
  result: PipelineRunResult,
  triggeredBy: string,
): Promise<RawContent[]> {
  const allRaw: RawContent[] = [];
  const sourcePlan = await buildPipelineSourcePlan(regions, triggeredBy);

  for (const note of sourcePlan.notes) {
    console.log(`[Pipeline] Plan: ${note}`);
  }

  console.log(
    `[Pipeline] Regions: ${regions.length}, Keyword strategies: ${sourcePlan.keywordStrategies.length}, Pinned: ${sourcePlan.staticPinnedCount} static + ${sourcePlan.dbPinnedCount} DB = ${sourcePlan.pinnedStrategies.length} total`,
  );

  // Pinned URLs — all run in parallel (each is an independent HTTP fetch)
  const pinnedOutcomes = await Promise.allSettled(
    sourcePlan.pinnedStrategies.map(async (strategy) => {
      const fetchResult = await fetchPinnedUrl(strategy);
      for (const item of fetchResult.items) {
        (item as RawContent & { _hintCitySlug?: string })._hintCitySlug = strategy.hintCitySlug;
      }
      console.log(`[Pipeline] ${strategy.id} → ${fetchResult.items.length} items`);
      return fetchResult;
    }),
  );
  for (const outcome of pinnedOutcomes) {
    result.sourcesProcessed++;
    if (outcome.status === 'fulfilled') {
      allRaw.push(...outcome.value.items);
      result.errors.push(...outcome.value.errors);
    } else {
      result.errors.push(String(outcome.reason));
    }
  }

  if (sourcePlan.keywordStrategies.length > 0) {
    // Keyword strategies × regions — all combinations run in parallel.
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

// ─── Phase 2: Filter & Extract ─────────────────────────

async function filterRelevantItems(
  uniqueRaw: RawContent[],
  result: PipelineRunResult,
): Promise<RawContent[]> {
  console.log('[Pipeline] Stage 1: Relevance filter...');
  const relevanceResults = await filterRelevance(uniqueRaw);
  const relevantItems = relevanceResults
    .filter((r) => r.isRelevant)
    .map((r) => uniqueRaw[r.index])
    .filter((item): item is RawContent => item != null);

  result.itemsPassedFilter = relevantItems.length;
  console.log(`[Pipeline] Passed filter: ${relevantItems.length}/${uniqueRaw.length}`);

  return relevantItems;
}

async function extractRelevantItems(
  relevantItems: RawContent[],
  result: PipelineRunResult,
): Promise<ExtractedItem[]> {
  console.log('[Pipeline] Stage 2: Batch extraction...');
  const extracted = await extractBatch(relevantItems);
  result.itemsExtracted = extracted.length;
  const eventCount = extracted.filter((item) => item.type === 'EVENT').length;
  const communityCount = extracted.filter((item) => item.type === 'COMMUNITY').length;
  console.log(
    `[Pipeline] Extracted: ${extracted.length} structured items (${eventCount} events, ${communityCount} communities)`,
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
  // Load region metros AND all their satellite cities so that communities
  // in satellite cities (e.g. esslingen → stuttgart metro) resolve correctly.
  // This avoids manually enumerating satellite slugs in source defaults.
  const cities = await db.city.findMany({
    where: {
      OR: [{ slug: { in: allCitySlugs } }, { metroRegion: { slug: { in: allCitySlugs } } }],
    },
    select: { id: true, slug: true, name: true },
  });
  const sourceReliabilityByType = await getSourceReliabilityMap();
  const cityBySlug = new Map<string, { id: string; name: string }>();

  for (const c of cities) {
    cityBySlug.set(c.slug, { id: c.id, name: c.name });
  }

  const decisionCounts = {
    queuedEvents: 0,
    queuedCommunities: 0,
    queuedPendingCityEvents: 0,
    queuedPendingCityCommunities: 0,
    duplicateEvents: 0,
    duplicateCommunities: 0,
    noCityEvents: 0,
    noCityCommunities: 0,
    pastEvents: 0,
  };

  const fallbackCitySlug = process.env.PIPELINE_NO_CITY_FALLBACK_SLUG?.trim();
  const fallbackCity = fallbackCitySlug ? (cityBySlug.get(fallbackCitySlug) ?? null) : null;

  for (const item of extracted) {
    const sourceRaw = relevantItems[item.sourceIndex];
    if (!sourceRaw) continue;

    // Resolve city: LLM cityName → DB lookup
    // Fallback chain: LLM cityName → hintCitySlug from pinned URL → skip
    let cityId: string | null = null;

    if (item.cityName) {
      const match = resolveCityMatch(item.cityName, cities, CITY_NAME_ALIASES);
      if (match) cityId = match.id;
    }

    if (!cityId) {
      const hint = (sourceRaw as RawContent & { _hintCitySlug?: string })._hintCitySlug;
      if (hint) {
        const match = cityBySlug.get(hint);
        if (match) cityId = match.id;
      }
    }

    let isCityPending = false;
    if (!cityId && fallbackCity && fallbackCitySlug) {
      cityId = fallbackCity.id;
      isCityPending = true;
      console.log(
        `[Pipeline] Pending city fallback: ${item.type === 'EVENT' ? item.title : item.name} — cityName: ${item.cityName ?? 'n/a'} => ${fallbackCitySlug}`,
      );
    }

    let cityConflict = false;
    let cityConflictReason: string | undefined;
    if (item.type === 'EVENT') {
      const signalCity = inferCityFromEventSignals(item, cities);
      if (signalCity) {
        if (!cityId) {
          cityId = signalCity.id;
        } else if (cityId !== signalCity.id) {
          cityConflict = true;
          cityId = signalCity.id;
          cityConflictReason = `City conflict: LLM city "${item.cityName ?? 'unknown'}" disagreed with event location signals; assigned "${signalCity.name}".`;
          console.warn(
            `[Pipeline] City conflict corrected for event "${item.title}": llm="${item.cityName ?? 'unknown'}" signal="${signalCity.name}"`,
          );
        }
      }
    }

    if (!cityId) {
      result.itemsSkippedNoCity++;
      if (item.type === 'EVENT') {
        decisionCounts.noCityEvents++;
      } else {
        decisionCounts.noCityCommunities++;
      }
      console.log(
        `[Pipeline] Skipped (no city): ${item.type === 'EVENT' ? item.title : item.name} — cityName: ${item.cityName}`,
      );
      continue;
    }

    // Skip events that have already passed — no value in queuing stale content
    if (item.type === 'EVENT' && item.date) {
      const eventDate = new Date(`${item.date}T23:59:59`);
      if (!Number.isNaN(eventDate.getTime()) && eventDate < new Date()) {
        result.itemsSkippedPast++;
        decisionCounts.pastEvents++;
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
      continue;
    }

    if (isDupe.isDuplicate && isDupe.matchScore && isDupe.matchScore > 0.9) {
      result.itemsSkippedDuplicate++;
      if (item.type === 'EVENT') {
        decisionCounts.duplicateEvents++;
      } else {
        decisionCounts.duplicateCommunities++;
      }
      continue;
    }

    const reliability = sourceReliabilityByType.get(sourceRaw.sourceType as PipelineSourceType);
    const confidence = applySourceConfidenceAdjustment(
      item.confidence,
      reliability?.confidenceAdjustment ?? 0,
    );

    // Queue for review
    const createdItem = await db.pipelineItem.create({
      data: {
        entityType: item.type === 'EVENT' ? 'EVENT' : 'COMMUNITY',
        sourceType: sourceRaw.sourceType as import('@prisma/client').PipelineSourceType,
        sourceUrl: sourceRaw.sourceUrl,
        rawContent: sourceRaw.text.slice(0, 50_000),
        extractedData: item as unknown as import('@prisma/client').Prisma.InputJsonValue,
        confidence,
        cityId,
        matchedEntityId: isDupe.matchedId ?? undefined,
        matchScore: isDupe.matchScore ?? undefined,
        reviewNotes: isCityPending
          ? `CITY_PENDING: extracted city "${item.cityName ?? 'unknown'}" did not match configured cities; queued with fallback city "${fallbackCitySlug}" for admin review.`
          : cityConflict
            ? cityConflictReason
            : undefined,
        metadata:
          isCityPending || cityConflict
            ? ({
                cityResolution: {
                  status: isCityPending ? 'PENDING' : 'CORRECTED',
                  extractedCityName: item.cityName ?? null,
                  fallbackCitySlug: isCityPending ? fallbackCitySlug : null,
                  reason: isCityPending
                    ? 'No city match found in configured cities/aliases.'
                    : (cityConflictReason ?? 'City conflict corrected from event signals.'),
                },
              } as Prisma.InputJsonValue)
            : undefined,
      },
      select: { id: true },
    });

    result.itemsQueued++;
    if (item.type === 'EVENT') {
      decisionCounts.queuedEvents++;
      if (isCityPending) decisionCounts.queuedPendingCityEvents++;
    } else {
      decisionCounts.queuedCommunities++;
      if (isCityPending) decisionCounts.queuedPendingCityCommunities++;
    }

    const autoApprove =
      item.type === 'EVENT'
        ? { eligible: false, reason: 'event-admin-approval-required' }
        : shouldAutoApprovePipelineItem({
            item: { ...item, confidence },
            sourceType: sourceRaw.sourceType as PipelineSourceType,
            reliability,
            matchedEntityId: isDupe.matchedId,
            matchScore: isDupe.matchScore,
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
    `[Pipeline] Queue decisions: queued ${decisionCounts.queuedEvents} events/${decisionCounts.queuedCommunities} communities (city-pending ${decisionCounts.queuedPendingCityEvents} events/${decisionCounts.queuedPendingCityCommunities} communities); duplicates ${decisionCounts.duplicateEvents} events/${decisionCounts.duplicateCommunities} communities; no-city ${decisionCounts.noCityEvents} events/${decisionCounts.noCityCommunities} communities; past events ${decisionCounts.pastEvents}`,
  );
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

  return checkCommunityDuplicate(item, cityId);
}

function normalizeSourceUrlForDedup(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    return `${url.hostname.toLowerCase()}${pathname}`;
  } catch {
    return sourceUrl.toLowerCase().replace(/\/+$/, '');
  }
}

async function checkSourceUrlDuplicate(
  sourceUrl: string,
  cityId: string,
  itemType: ExtractedData['type'],
): Promise<DedupResult> {
  const entityType = itemType === 'EVENT' ? 'EVENT' : 'COMMUNITY';
  const existingQueueItem = await db.pipelineItem.findFirst({
    where: {
      sourceUrl,
      cityId,
      entityType,
      status: { in: ['PENDING', 'APPROVED'] },
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
      status: { in: ['PENDING', 'APPROVED'] },
      sourceUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
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

function inferCityFromEventSignals(
  event: ExtractedEvent,
  cities: Array<{ id: string; slug: string; name: string }>,
): { id: string; slug: string; name: string } | null {
  const strongSignals = [event.venueAddress, event.venueName, event.hostCommunity];

  for (const signal of strongSignals) {
    const matches = findCitiesMentionedInText(signal, cities, CITY_NAME_ALIASES);
    if (matches.length === 1) return matches[0] ?? null;
  }

  const titleMatches = findCitiesMentionedInText(event.title, cities, CITY_NAME_ALIASES);
  if (titleMatches.length === 1) return titleMatches[0] ?? null;

  return null;
}

export function normalizeEventTitleForDedup(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\b(stuttgart|frankfurt|karlsruhe|mannheim|munich|muenchen|münchen)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/$/, '');
    return `${url.hostname.toLowerCase()}${pathname}`;
  } catch {
    return value.toLowerCase().replace(/\/$/, '');
  }
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
    select: { id: true, title: true, registrationUrl: true },
  });

  const normalizedIncomingTitle = normalizeEventTitleForDedup(event.title);
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
    const normalizedCandidateTitle = normalizeEventTitleForDedup(candidate.title);
    const canonicalTitleMatch =
      normalizedIncomingTitle.length >= 8 && normalizedIncomingTitle === normalizedCandidateTitle;
    if (score > 0.7 || canonicalTitleMatch) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: score, matchKind: 'ENTITY' };
    }
  }

  const pendingItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'EVENT',
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true, extractedData: true },
  });

  for (const candidate of pendingItems) {
    const pendingEvent = candidate.extractedData as unknown as Partial<ExtractedEvent>;
    if (!pendingEvent.title || !pendingEvent.date) continue;

    const candidateDate = new Date(`${pendingEvent.date}T12:00:00`);
    if (Number.isNaN(candidateDate.getTime())) continue;
    const dayDiff = Math.abs(eventDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff > 1) continue;

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
    const normalizedPendingTitle = normalizeEventTitleForDedup(pendingEvent.title);
    const canonicalTitleMatch =
      normalizedIncomingTitle.length >= 8 && normalizedIncomingTitle === normalizedPendingTitle;
    if (score > 0.7 || canonicalTitleMatch) {
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

  for (const candidate of candidates) {
    const score = computeSimilarity(community.name.toLowerCase(), candidate.name.toLowerCase());
    if (score > 0.7) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: score, matchKind: 'ENTITY' };
    }
    if (score >= 0.5) {
      borderlineCandidates.push({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        cityName: candidate.city.name,
      });
    }
  }

  const semanticMatch = await semanticCommunityDuplicateCheck(
    community,
    borderlineCandidates.slice(0, 5),
  );
  if (semanticMatch) {
    return {
      isDuplicate: true,
      matchedId: semanticMatch.matchedId,
      matchScore: semanticMatch.confidence,
      matchKind: 'ENTITY',
    };
  }

  const pendingCommunityItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'COMMUNITY',
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true, extractedData: true },
  });

  const normalizedIncomingName = community.name
    .toLowerCase()
    .replace(/\b(e\.?\s?v\.?|verein|society|association|community|group|chapter)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  for (const pending of pendingCommunityItems) {
    const pendingCommunity = pending.extractedData as unknown as Partial<ExtractedData>;
    if (pendingCommunity.type !== 'COMMUNITY' || !pendingCommunity.name) continue;

    const pendingName = String(pendingCommunity.name)
      .toLowerCase()
      .replace(/\b(e\.?\s?v\.?|verein|society|association|community|group|chapter)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    const score = computeSimilarity(normalizedIncomingName, pendingName);
    if (
      score > 0.7 ||
      (normalizedIncomingName.length >= 8 && normalizedIncomingName === pendingName)
    ) {
      return {
        isDuplicate: true,
        matchedId: pending.id,
        matchScore: score,
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
 * Good enough for dedup — not a full fuzzy match.
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) intersection++;
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}
