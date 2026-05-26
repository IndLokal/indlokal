# TDD-0027: Per-LLM-call audit & cost telemetry

- **Status:** Approved
- **Linked PRD:** PRD-0027
- **Owner:** Platform

## 1. Architecture overview

```
runPipeline()
  └── (new) creates PipelineRun row UP-FRONT, gets runId
       └── threads runId via React-free async context (AsyncLocalStorage)
            └── extraction.ts callOpenAI()
                 └── on every call (success OR failure):
                      void db.pipelineLlmCall.create({ runId, stage, ... })
```

A single AsyncLocalStorage carries `{ runId, stage }` across the call chain. This avoids plumbing `runId` through every function signature in `extraction.ts` / `intelligence.ts`.

## 2. Data model changes

```prisma
enum PipelineLlmStage {
  filter
  extract
  dedup
  enrich
  keyword
}

model PipelineLlmCall {
  id                String           @id @default(cuid())
  runId             String           @map("run_id")
  run               PipelineRun      @relation(fields: [runId], references: [id], onDelete: Cascade)
  stage             PipelineLlmStage
  model             String
  promptTokens      Int              @default(0) @map("prompt_tokens")
  completionTokens  Int              @default(0) @map("completion_tokens")
  totalTokens       Int              @default(0) @map("total_tokens")
  durationMs        Int              @map("duration_ms")
  ok                Boolean
  errorCode         String?          @map("error_code")
  batchSize         Int?             @map("batch_size")
  createdAt         DateTime         @default(now()) @map("created_at")

  @@index([runId])
  @@index([createdAt, stage])
  @@map("pipeline_llm_calls")
}

model PipelineRun {
  // ...existing...
  llmCalls  PipelineLlmCall[]
}
```

Migration: `20260526170000_add_pipeline_llm_calls` — `CREATE TYPE`, `CREATE TABLE`, two indexes, FK. No backfill (current rows have no audit; they keep their aggregate counters).

## 3. API surface

No new HTTP endpoints. Two read-only conveniences in the codebase:

```ts
// src/modules/pipeline/audit.ts
export async function costByStageInWindow(fromDays: number): Promise<...> {
  return db.$queryRaw`
    SELECT stage,
           COUNT(*) AS calls,
           SUM(total_tokens) AS tokens,
           SUM(duration_ms) AS duration_ms,
           SUM(CASE WHEN ok THEN 0 ELSE 1 END) AS failures
    FROM pipeline_llm_calls
    WHERE created_at >= NOW() - (${fromDays}::int * INTERVAL '1 day')
    GROUP BY stage
    ORDER BY tokens DESC
  `;
}
```

(This helper is not wired to any route in this iteration — direct SQL access is sufficient.)

## 4. Module changes

### 4.1 `src/modules/pipeline/llm-context.ts` (new)

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type { PipelineLlmStage } from '@prisma/client';

export type LlmCallContext = { runId: string; stage: PipelineLlmStage };

const storage = new AsyncLocalStorage<LlmCallContext>();

export function withLlmContext<T>(ctx: LlmCallContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentLlmContext(): LlmCallContext | undefined {
  return storage.getStore();
}
```

### 4.2 `src/modules/pipeline/extraction.ts` (changed)

```ts
import { currentLlmContext } from './llm-context';

export async function callOpenAI(messages, opts = {}): Promise<string> {
  const startedAt = Date.now();
  const ctx = currentLlmContext();
  const model = opts.model ?? process.env.PIPELINE_LLM_MODEL ?? 'gpt-4o-mini';
  const batchSize = opts.batchSize;

  try {
    // ...existing fetch...
    const tokens = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);
    llmCallCount++;
    llmTokenEstimate += tokens;
    void recordLlmCall({
      ctx,
      model,
      batchSize,
      ok: true,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: tokens,
      durationMs: Date.now() - startedAt,
    });
    return content;
  } catch (err) {
    void recordLlmCall({
      ctx,
      model,
      batchSize,
      ok: false,
      errorCode: classifyError(err),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
```

`recordLlmCall` is fire-and-forget; logs but does not throw on DB failure. If `ctx` is missing (e.g. CLI run without `runId`), the call is **not** persisted — only the aggregate counter is updated. This keeps unit tests and ad-hoc CLI usage from requiring a DB.

`classifyError(err)` returns a short string: `'timeout' | 'http_4xx' | 'http_5xx' | 'parse_error' | 'unknown'`.

### 4.3 `src/modules/pipeline/orchestrator.ts` (changed)

```ts
// Create PipelineRun row UP-FRONT so we have a runId for audit FKs.
const pipelineRun = await db.pipelineRun.create({
  data: { triggeredBy, scopeRegionIds, scopeCitySlugs, /* zeros for counters */ },
});

const result = await withLlmContext({ runId: pipelineRun.id, stage: 'filter' }, async () => {
  // wrap each stage with withLlmContext(stage=...) for the correct stage tag
  // ...
});

// Final update with computed counters
await db.pipelineRun.update({ where: { id: pipelineRun.id }, data: { ...result, durationMs: ... } });
```

Per-stage wrapping uses small helpers so the existing `timePipelineStage` keeps its signature.

`intelligence.ts` semantic dedup wraps its call with `stage: 'dedup'`. Enrichment cron wraps with `'enrich'`. Keyword cron with `'keyword'`.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

`PIPELINE_AUDIT_LLM_CALLS=0` env var disables the audit write (keeps counters). Default: on. Provides a kill-switch if the writes ever produce DB pressure — extremely unlikely at current scale but cheap insurance.

## 7. Observability

The whole spec is observability. Self-referential.

Canonical operator queries (documented in `docs/architecture-review/PIPELINE_OPERATOR_QUERIES.md`, added with this PR):

```sql
-- Cost & reliability by stage, last 7 days
SELECT stage, COUNT(*) calls, SUM(total_tokens) tokens,
       ROUND(AVG(duration_ms)) avg_ms,
       SUM((NOT ok)::int) failures
FROM pipeline_llm_calls
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY stage ORDER BY tokens DESC;

-- Failure rate by error_code, last 24h
SELECT error_code, COUNT(*) FROM pipeline_llm_calls
WHERE created_at >= NOW() - INTERVAL '1 day' AND NOT ok
GROUP BY error_code ORDER BY 2 DESC;

-- All calls for a specific pipeline run
SELECT stage, model, batch_size, total_tokens, duration_ms, ok, error_code
FROM pipeline_llm_calls
WHERE run_id = $1
ORDER BY created_at;
```

## 8. Failure modes & fallbacks

| Failure                              | Behaviour                                                  |
| ------------------------------------ | ---------------------------------------------------------- |
| `pipeline_llm_calls.create` throws   | Logged at `warn`; pipeline continues                       |
| Missing `runId` context (CLI / test) | Audit row skipped; aggregate counters still update         |
| Up-front `pipelineRun.create` fails  | Run aborts at top with error — same as today, just earlier |
| Final `pipelineRun.update` fails     | Same handling as current `pipelineRun.create` error path   |

## 9. Test plan

Unit:

- `withLlmContext` propagates correctly across `await`.
- `classifyError` for timeout / 4xx / 5xx / parse / unknown.
- `recordLlmCall` no-ops cleanly without context.

Integration (manual after deploy):

- Run `pnpm pipeline --region berlin` against staging DB; verify N+ rows in `pipeline_llm_calls` matching `getLlmStats()` output.

## 10. Rollout plan

Single deploy with PRD-0026 changes. No flag toggle needed.

1. Migration creates table + indexes.
2. First cron run after deploy creates `PipelineRun` row up-front and per-call audit rows.
3. Operator runs the canonical query the next day to validate end-to-end.

## 11. Backout plan

- Code revert restores aggregate-only counters.
- `PIPELINE_AUDIT_LLM_CALLS=0` env toggle is the fast kill-switch without revert.
- Table remains in place (additive).
