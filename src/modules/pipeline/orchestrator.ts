/**
 * Pipeline orchestrator — generic-first content discovery pipeline.
 *
 * Flow:
 *   1. FETCH — keyword strategies × regions (parallel) + pinned URLs (parallel)
 *   2. FILTER — Stage 1 LLM: cheap batch relevance check (drops 60-80% noise)
 *   3. EXTRACT — Stage 2 LLM: structured extraction with city assignment
 *   4. RESOLVE — map LLM cityName → DB city ID
 *   5. DEDUP — bigram similarity check against existing DB entities + queue
 *   6. QUEUE — store in PipelineItem for admin review
 *
 * Adding a new country: add region + keyword strategies in config.ts. Done.
 * No orchestrator changes needed for new regions.
 */

import { db } from '@/lib/db';
import { Prisma, type PipelineSourceType } from '@prisma/client';
import { getEnabledRegions, getKeywordStrategies, getPinnedStrategies } from './config';
import { getDbCommunityStrategies } from './db-sources';
import {
  fetchEventbriteKeywords,
  fetchPinnedUrl,
  fetchGoogleSearch,
  fetchDuckDuckGoSearch,
} from './sources';
import { filterRelevance, extractBatch, resetLlmStats, getLlmStats } from './extraction';
import { applySourceConfidenceAdjustment, getSourceReliabilityMap } from './reliability';
import { getApprovedDynamicKeywords, semanticCommunityDuplicateCheck } from './intelligence';
import { shouldAutoApprovePipelineItem, approvePipelineItemRecord } from './review';
import type { ExtractedData, ExtractedEvent, RawContent, PipelineRunResult } from './types';

// Re-export PipelineRunResult type from types.ts
export type { PipelineRunResult } from './types';

/**
 * Run the full generic-first pipeline.
 * No arguments needed — reads config from config.ts.
 */
export async function runPipeline(): Promise<PipelineRunResult> {
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
    errors: [],
    llmCalls: 0,
    llmTokensEstimate: 0,
    duration: 0,
  };

  // Phase 1: Fetch from all sources + URL dedup
  const regions = getEnabledRegions();
  const uniqueRaw = await fetchAllSources(regions, result);

  if (uniqueRaw.length === 0) {
    result.duration = Date.now() - start;
    return result;
  }

  // Phase 2: LLM relevance filter + structured extraction
  const { extracted, relevantItems } = await filterAndExtract(uniqueRaw, result);

  if (extracted.length === 0) {
    const stats = getLlmStats();
    result.llmCalls = stats.calls;
    result.llmTokensEstimate = stats.tokensEstimate;
    result.duration = Date.now() - start;
    return result;
  }

  // Phase 3: Resolve cities, dedup, queue for review
  await resolveAndQueue(extracted, relevantItems, regions, result);

  const stats = getLlmStats();
  result.llmCalls = stats.calls;
  result.llmTokensEstimate = stats.tokensEstimate;
  result.duration = Date.now() - start;

  console.log(
    `[Pipeline] Done: ${result.itemsQueued} queued, ${result.itemsSkippedDuplicate} dupes, ${result.itemsSkippedNoCity} no-city, ${result.llmCalls} LLM calls (~${result.llmTokensEstimate} tokens) in ${result.duration}ms`,
  );

  return result;
}

// ─── Phase 1: Fetch ────────────────────────────────────

type Region = ReturnType<typeof getEnabledRegions>[number];

async function fetchAllSources(
  regions: Region[],
  result: PipelineRunResult,
): Promise<RawContent[]> {
  const allRaw: RawContent[] = [];
  const approvedKeywords = await getApprovedDynamicKeywords();
  const keywordStrategies = getKeywordStrategies().map((strategy) =>
    strategy.kind === 'keyword_search'
      ? {
          ...strategy,
          keywords: [...new Set([...strategy.keywords, ...approvedKeywords])],
        }
      : strategy,
  );
  const staticPinned = getPinnedStrategies();
  const dbPinned = await getDbCommunityStrategies();
  const pinnedStrategies = [...staticPinned, ...dbPinned];

  console.log(
    `[Pipeline] Regions: ${regions.length}, Keyword strategies: ${keywordStrategies.length}, Pinned: ${staticPinned.length} static + ${dbPinned.length} DB = ${pinnedStrategies.length} total`,
  );

  // Keyword strategies × regions
  for (const region of regions) {
    result.regionsScanned++;
    for (const strategy of keywordStrategies) {
      try {
        let fetchResult;
        if (strategy.sourceType === 'GOOGLE_SEARCH') {
          fetchResult = await fetchGoogleSearch(strategy, region);
        } else if (strategy.sourceType === 'DUCKDUCKGO') {
          fetchResult = await fetchDuckDuckGoSearch(strategy, region);
        } else {
          fetchResult = await fetchEventbriteKeywords(strategy, region);
        }
        allRaw.push(...fetchResult.items);
        result.errors.push(...fetchResult.errors);
        result.sourcesProcessed++;
        console.log(`[Pipeline] ${strategy.id}:${region.id} → ${fetchResult.items.length} items`);
      } catch (err) {
        result.errors.push(`${strategy.id}:${region.id}: ${String(err)}`);
      }
    }
  }

  // Pinned URLs (run regardless of regions)
  for (const strategy of pinnedStrategies) {
    try {
      const fetchResult = await fetchPinnedUrl(strategy);
      for (const item of fetchResult.items) {
        (item as RawContent & { _hintCitySlug?: string })._hintCitySlug = strategy.hintCitySlug;
      }
      allRaw.push(...fetchResult.items);
      result.errors.push(...fetchResult.errors);
      result.sourcesProcessed++;
      console.log(`[Pipeline] ${strategy.id} → ${fetchResult.items.length} items`);
    } catch (err) {
      result.errors.push(`${strategy.id}: ${String(err)}`);
    }
  }

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

async function filterAndExtract(
  uniqueRaw: RawContent[],
  result: PipelineRunResult,
): Promise<{ extracted: ExtractedItem[]; relevantItems: RawContent[] }> {
  console.log('[Pipeline] Stage 1: Relevance filter...');
  const relevanceResults = await filterRelevance(uniqueRaw);
  const relevantItems = relevanceResults
    .filter((r) => r.isRelevant)
    .map((r) => uniqueRaw[r.index])
    .filter((item): item is RawContent => item != null);

  result.itemsPassedFilter = relevantItems.length;
  console.log(`[Pipeline] Passed filter: ${relevantItems.length}/${uniqueRaw.length}`);

  if (relevantItems.length === 0) {
    return { extracted: [], relevantItems: [] };
  }

  console.log('[Pipeline] Stage 2: Batch extraction...');
  const extracted = await extractBatch(relevantItems);
  result.itemsExtracted = extracted.length;
  console.log(`[Pipeline] Extracted: ${extracted.length} structured items`);

  return { extracted, relevantItems };
}

// ─── Phase 3: Resolve, Dedup & Queue ───────────────────

async function resolveAndQueue(
  extracted: ExtractedItem[],
  relevantItems: RawContent[],
  regions: Region[],
  result: PipelineRunResult,
): Promise<void> {
  const allCitySlugs = regions.flatMap((r) => r.citySlugs);
  const cities = await db.city.findMany({
    where: { slug: { in: allCitySlugs } },
    select: { id: true, slug: true, name: true },
  });
  const sourceReliabilityByType = await getSourceReliabilityMap();
  const cityByName = new Map<string, { id: string; slug: string }>();
  const cityBySlug = new Map<string, { id: string; name: string }>();
  for (const c of cities) {
    cityByName.set(c.name.toLowerCase(), { id: c.id, slug: c.slug });
    cityBySlug.set(c.slug, { id: c.id, name: c.name });
  }

  for (const item of extracted) {
    const sourceRaw = relevantItems[item.sourceIndex];
    if (!sourceRaw) continue;

    // Resolve city: LLM cityName → DB lookup
    // Fallback chain: LLM cityName → hintCitySlug from pinned URL → skip
    let cityId: string | null = null;

    if (item.cityName) {
      const match = cityByName.get(item.cityName.toLowerCase());
      if (match) cityId = match.id;
    }

    if (!cityId) {
      const hint = (sourceRaw as RawContent & { _hintCitySlug?: string })._hintCitySlug;
      if (hint) {
        const match = cityBySlug.get(hint);
        if (match) cityId = match.id;
      }
    }

    if (!cityId) {
      result.itemsSkippedNoCity++;
      console.log(
        `[Pipeline] Skipped (no city): ${item.type === 'EVENT' ? item.title : item.name} — cityName: ${item.cityName}`,
      );
      continue;
    }

    // Dedup check
    const isDupe = await checkDuplicate(item, cityId, sourceRaw.sourceUrl);
    if (
      item.type === 'EVENT' &&
      isDupe.isDuplicate &&
      isDupe.matchKind === 'PIPELINE_ITEM' &&
      isDupe.matchedId
    ) {
      await mergeIntoPendingEventPipelineItem(isDupe.matchedId, item, sourceRaw);
      result.itemsSkippedDuplicate++;
      continue;
    }

    if (isDupe.isDuplicate && isDupe.matchScore && isDupe.matchScore > 0.9) {
      result.itemsSkippedDuplicate++;
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
      },
      select: { id: true },
    });

    result.itemsQueued++;

    const autoApprove = shouldAutoApprovePipelineItem({
      item: { ...item, confidence },
      sourceType: sourceRaw.sourceType as PipelineSourceType,
      reliability,
      matchedEntityId: isDupe.matchedId,
      matchScore: isDupe.matchScore,
    });
    if (autoApprove.eligible) {
      await approvePipelineItemRecord(createdItem.id, {
        reviewedBy: 'system',
        autoApproved: true,
        autoApprovalReason: autoApprove.reason,
      });
    }
  }
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
  // Exact source URL match in queue
  const existingQueueItem = await db.pipelineItem.findFirst({
    where: {
      sourceUrl,
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

  if (item.type === 'EVENT') {
    return checkEventDuplicate(item, cityId);
  }

  return checkCommunityDuplicate(item, cityId);
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
    select: { id: true, title: true },
  });

  for (const candidate of candidates) {
    const score = computeSimilarity(event.title.toLowerCase(), candidate.title.toLowerCase());
    if (score > 0.7) {
      return { isDuplicate: true, matchedId: candidate.id, matchScore: score, matchKind: 'ENTITY' };
    }
  }

  const pendingItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'EVENT',
      status: 'PENDING',
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

    const score = computeSimilarity(event.title.toLowerCase(), pendingEvent.title.toLowerCase());
    if (score > 0.7) {
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
