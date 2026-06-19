// ─── Extraction + OpenAI client ─────────────────────────────────────────
export {
  callOpenAI,
  filterRelevance,
  extractBatch,
  normalizeParsedItemForTest,
  __testing,
  resetLlmStats,
  getLlmStats,
  PipelineBudgetExceededError,
  PipelineCircuitOpenError,
} from './extraction';

// ─── LLM run context/audit attribution ─────────────────────────────────
export { withLlmContext, currentLlmContext } from './llm-context';
export type { LlmAuditLane, LlmCallContext } from './llm-context';

// ─── Text utilities ─────────────────────────────────────────────────────
export { collapseWhitespace, decodeHtmlEntities, htmlToText } from './text';
