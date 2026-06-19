/**
 * AsyncLocalStorage carrying the current pipeline run id and LLM stage tag.
 *
 * Set by `runPipeline` and per-stage wrappers in `orchestrator.ts`; read by
 * `callOpenAI` in `extraction.ts` (and future enrichment/keyword call sites)
 * to attribute each `PipelineLlmCall` audit row to the right run + stage.
 *
 * Spec: docs/specs/TDD/0027-pipeline-llm-call-audit.md
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { PipelineLlmStage } from '@prisma/client';
import type { PipelineLane } from '../types';

/** LLM audit lane tags mirror pipeline lanes, with DEFAULT for mixed/unknown batches. */
export type LlmAuditLane = PipelineLane | 'DEFAULT';

export type LlmCallContext = { runId: string; stage: PipelineLlmStage; lane?: LlmAuditLane };

const storage = new AsyncLocalStorage<LlmCallContext>();

export function withLlmContext<T>(ctx: LlmCallContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/** Returns the active context if any. Absent in CLI/test paths - callers must tolerate undefined. */
export function currentLlmContext(): LlmCallContext | undefined {
  return storage.getStore();
}
