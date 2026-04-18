/**
 * AI Content Pipeline module.
 *
 * Generic-first architecture: broad search → cheap LLM filter →
 * batch extraction with city assignment → dedup → admin review queue.
 *
 * @see docs/SOLUTION_ARCHITECTURE.md §10.4
 */

export { runPipeline } from './orchestrator';
export type { PipelineRunResult } from './types';
export { filterRelevance, extractBatch, extractContent } from './extraction';
export {
  fetchEventbriteKeywords,
  fetchPinnedUrl,
  fetchGoogleSearch,
  fetchDuckDuckGoSearch,
} from './sources';
export {
  getEnabledRegions,
  getKeywordStrategies,
  getPinnedStrategies,
  SEARCH_REGIONS,
  SEARCH_STRATEGIES,
  DIASPORA_KEYWORDS,
} from './config';
export { getDbCommunityStrategies } from './db-sources';
export { computeSimilarity } from './orchestrator';
export {
  getSourceReliabilityStats,
  getSourceReliabilityMap,
  applySourceConfidenceAdjustment,
} from './reliability';
export {
  semanticCommunityDuplicateCheck,
  enrichSparseCommunities,
  inferCommunityRelationships,
  refreshKeywordSuggestions,
  getApprovedDynamicKeywords,
} from './intelligence';
export {
  shouldAutoApprovePipelineItem,
  approvePipelineItemRecord,
  revertAutoApprovedPipelineItems,
} from './review';
export type {
  RawContent,
  ExtractedEvent,
  ExtractedCommunity,
  ExtractedData,
  FetchResult,
  SearchStrategy,
  SearchRegion,
  RelevanceResult,
} from './types';
export type { SourceReliabilityStat } from './reliability';
