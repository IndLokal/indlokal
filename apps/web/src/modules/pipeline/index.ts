/**
 * AI Content Pipeline module.
 *
 * Generic-first architecture: broad search → cheap LLM filter →
 * batch extraction with city assignment → dedup → admin review queue.
 *
 * Public API only — internal helpers (sources, extraction stages, config
 * constants) are imported directly by orchestrator and CLI (run.ts).
 *
 * @see docs/SOLUTION_ARCHITECTURE.md §10.4
 */

// ─── Core pipeline ──────────────────────────────────────────────────────
export { runPipeline, computeSimilarity } from './orchestrator';

// ─── Review & approval ──────────────────────────────────────────────────
export { approvePipelineItemRecord, revertAutoApprovedPipelineItems } from './review';

// ─── Intelligence (cron jobs) ───────────────────────────────────────────
export {
  enrichSparseCommunities,
  inferCommunityRelationships,
  refreshKeywordSuggestions,
} from './intelligence';

// ─── Reliability stats (admin UI) ───────────────────────────────────────
export { getSourceReliabilityStats } from './reliability';

// ─── Types ──────────────────────────────────────────────────────────────
export type { PipelineRunResult, ExtractedEvent, ExtractedCommunity, ExtractedData } from './types';
export type { SourceReliabilityStat } from './reliability';
