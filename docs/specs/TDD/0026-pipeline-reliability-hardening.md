# TDD-0026: Pipeline reliability hardening (Phase 0)

- **Status:** Approved
- **Linked PRD:** PRD-0026
- **Owner:** Platform

## 1. Architecture overview

Five surgical, independent changes inside the existing pipeline. No new modules except a small `advisory-lock` helper. No changes to source planning, dedup logic, or the LLM prompts.

```
┌──────────────────────────────────────────────────────────────────┐
│ /api/cron/pipeline (POST)                                         │
│   ├── [NEW] Postgres advisory lock per scope-key (try / release) │
│   └── runPipeline(triggeredBy, scope)                            │
│        ├── fetch                                                  │
│        ├── prefilter                                              │
│        ├── filter                                                 │
│        │    └── [CHANGED] on error → return [], filterFailures++  │
│        ├── extract                                                │
│        │    └── [CHANGED] RetryBudget threads through split       │
│        └── resolveQueue                                           │
│             └── [CHANGED] reject items with out-of-range index    │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Data model changes

Add three counter columns to `PipelineRun` and matching fields on `PipelineRunResult`:

```prisma
model PipelineRun {
  // ...existing fields...
  filterFailures           Int @default(0) @map("filter_failures")
  extractRetriesExhausted  Int @default(0) @map("extract_retries_exhausted")
  itemsDroppedBadIndex     Int @default(0) @map("items_dropped_bad_index")
}
```

Migration: `20260526160000_add_pipeline_reliability_counters` — three `ALTER TABLE pipeline_runs ADD COLUMN ... DEFAULT 0 NOT NULL`.

No data backfill required (counters start at 0 for historical rows; default handles it).

## 3. API surface

No new HTTP endpoints. Cron handler response shape gains an optional `reason` field:

```ts
// /api/cron/pipeline response on lock conflict
{ ok: false, reason: 'locked', scope: {...} } // HTTP 409
```

## 4. Module changes

### 4.1 `src/lib/db/advisory-lock.ts` (new)

```ts
import { db } from '@/lib/db';

/**
 * Postgres session-level advisory lock keyed by a string.
 *
 *   - try-acquire (non-blocking) → returns false if held by another session.
 *   - the lock is held until `release()` is called or the session ends.
 *
 * Uses `hashtextextended()` (two-arg) so both 32-bit halves of a 64-bit
 * lock key are used; collision risk is ~1/2^31 within a process.
 */
export async function tryAdvisoryLock(key: string): Promise<{
  acquired: boolean;
  release: () => Promise<void>;
}> {
  const rows = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtextextended(${key}, 0)) AS locked
  `;
  const acquired = rows[0]?.locked === true;
  return {
    acquired,
    release: async () => {
      if (!acquired) return;
      await db.$executeRaw`SELECT pg_advisory_unlock(hashtextextended(${key}, 0))`;
    },
  };
}
```

Notes:

- Session-level (not transaction-level) because the pipeline runs across many implicit Prisma transactions.
- We deliberately do _not_ throw on a missing lock — callers decide the response.

### 4.2 `src/app/api/cron/pipeline/route.ts` (changed)

After auth, before `runPipeline`:

```ts
const lockKey = `pipeline:cron:${[
  ...(citySlugs.length > 0 ? ['city=' + citySlugs.sort().join(',')] : []),
  ...(regionIds.length > 0 ? ['region=' + regionIds.sort().join(',')] : []),
  ...(citySlugs.length === 0 && regionIds.length === 0 ? ['global'] : []),
].join('|')}`;

const lock = await tryAdvisoryLock(lockKey);
if (!lock.acquired) {
  return NextResponse.json(
    { ok: false, reason: 'locked', scope: { citySlugs, regionIds } },
    { status: 409 },
  );
}
try {
  const result = await runPipeline('cron', scope);
  // ...captureServerEvent + JSON response...
} finally {
  await lock.release();
}
```

CLI namespace is `pipeline:cli:<scope>` (handled in a follow-up when CLI also needs locking — out of scope here).

### 4.3 `src/modules/pipeline/extraction.ts` (changed)

**a) Clamped env reads.**

```ts
const FILTER_BATCH_MIN = 1;
const FILTER_BATCH_MAX = 50;
const EXTRACT_BATCH_MIN = 1;
const EXTRACT_BATCH_MAX = 10;
const LLM_TIMEOUT_MIN_MS = 5_000;
const LLM_TIMEOUT_MAX_MS = 180_000;

function getClampedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(Math.max(parsed, min), max);
  if (clamped !== parsed) {
    console.warn(
      `[Pipeline] ${name}=${parsed} out of band [${min}..${max}], clamped to ${clamped}`,
    );
  }
  return clamped;
}
```

Replace existing `getPositiveIntEnv` callsites for the three knobs.

**b) Filter fail-closed.**

```ts
} catch (err) {
  console.error('[Pipeline] Filter batch failed (fail-closed, dropping batch):', String(err));
  recordFilterFailure();
  return []; // was: batch.map(... isRelevant: true)
}
```

A module-level counter `filterFailures` is exposed via `getLlmStats()` extension. `orchestrator.ts` reads it after the filter stage and writes to `result.filterFailures`.

**c) RetryBudget for batch split.**

```ts
export type RetryBudget = {
  remainingDepth: number;
  deadlineMs: number; // wall-clock epoch ms
};

function defaultExtractBudget(): RetryBudget {
  return {
    remainingDepth: 4, // enough for batch=16 → leaves of 1
    deadlineMs: Date.now() + 90_000, // 90s wall-clock for split retries
  };
}

async function extractBatchCall(
  batch: RawContent[],
  startIndex: number,
  budget: RetryBudget = defaultExtractBudget(),
): Promise<(ExtractedData & { sourceIndex: number })[]> {
  try {
    return await extractBatchCallOnce(batch, startIndex);
  } catch (err) {
    console.error(`[Pipeline] Extract batch failed (size=${batch.length}): ${String(err)}`);

    if (batch.length <= 1) return [];
    if (budget.remainingDepth <= 0 || Date.now() >= budget.deadlineMs) {
      recordExtractRetryExhaustion();
      console.warn(
        `[Pipeline] Extract retry budget exhausted (depth=${budget.remainingDepth}, ` +
          `deadline_in_ms=${budget.deadlineMs - Date.now()}); dropping ${batch.length} items`,
      );
      return [];
    }

    const nextBudget: RetryBudget = { ...budget, remainingDepth: budget.remainingDepth - 1 };
    const midpoint = Math.ceil(batch.length / 2);
    const first = await extractBatchCall(batch.slice(0, midpoint), startIndex, nextBudget);
    const second = await extractBatchCall(batch.slice(midpoint), startIndex + midpoint, nextBudget);
    return [...first, ...second];
  }
}
```

**d) Reject out-of-range LLM index.**

`normalizeSourceIndex` returns `null` instead of falling back to `startIndex` when the index is out of range. `normalizeParsedItem` returns `null` in that case; `extractBatchCallOnce` filters nulls and increments `recordBadIndexDrop()`.

```ts
function normalizeSourceIndex(
  index: unknown,
  startIndex: number,
  batchLength: number,
): number | null {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index >= startIndex && index < startIndex + batchLength) return index;
  if (index >= 0 && index < batchLength) return startIndex + index;
  return null;
}
```

### 4.4 `src/modules/pipeline/types.ts` and `orchestrator.ts` (changed)

Extend `PipelineRunResult`:

```ts
export type PipelineRunResult = {
  // ...existing...
  filterFailures: number;
  extractRetriesExhausted: number;
  itemsDroppedBadIndex: number;
};
```

After each stage, `orchestrator.ts` copies the module-level counters from `extraction.ts` into the result. `runPipeline` persists them to `PipelineRun`.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None. Behaviour change is small enough to ship under standard rollout. The clamp warning is a passive log, not a behaviour change for in-band values.

A single `PIPELINE_FILTER_FAIL_OPEN=1` escape hatch is **not** added — restoring fail-open requires a code revert, which we want to remain visible in git history.

## 7. Observability

- New `PipelineRun` counters surface in CLI output (`run.ts`), in the cron route response, and in the existing PostHog `PIPELINE_SHARD_COMPLETED` event payload (three new fields).
- Two structured log lines, both severity `warn`:
  - `[Pipeline] Filter batch failed (fail-closed, dropping batch): <err>`
  - `[Pipeline] Extract retry budget exhausted (...)`
- Lock conflicts emit `[cron/pipeline] lock conflict for key=<key>` at `info` level.

## 8. Failure modes & fallbacks

| Failure                                 | Old behaviour                                          | New behaviour                                                |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| OpenAI 5xx on filter                    | Mark all relevant → expensive extract → garbage queued | Drop batch, counter ++, next run retries source              |
| OpenAI sustained outage during extract  | Recursive split eats 300s                              | Budget exhausted after 90s wall-clock or depth 4; counter ++ |
| Concurrent cron triggers                | Both run; LLM double-billed; race on insert            | 2nd returns HTTP 409 immediately                             |
| Bad `PIPELINE_*` env value              | Silently accepted                                      | Clamped to safe band; warning logged                         |
| LLM hallucinates index 99 in batch of 3 | Attached to startIndex (wrong source)                  | Dropped; counter ++                                          |

## 9. Test plan

Unit (vitest, `__tests__/extraction.test.ts`):

- `filterRelevance` returns `[]` when `callOpenAI` throws (mocked via injected fetch).
- `getClampedIntEnv` clamps high, clamps low, accepts in-band, logs warning on clamp.
- `normalizeSourceIndex` returns `null` for out-of-range absolute index and out-of-range relative index.
- `extractBatchCall` with mocked-failing OpenAI exhausts `RetryBudget` after expected depth and returns `[]`.

Unit (vitest, new `__tests__/advisory-lock.test.ts`):

- Skipped in CI when `DATABASE_URL` for test DB is unavailable; otherwise: two concurrent `tryAdvisoryLock('x')` calls — only one acquired; after `release()`, the other can acquire.

No contract / E2E / load tests required (no public API surface change beyond an added `reason` field).

## 10. Rollout plan

Single deploy. No flag.

1. Merge migration + code together.
2. First cron run after deploy populates new counters.
3. Watch `PipelineRun.filterFailures` for 48h. Expected baseline: 0. Any non-zero row triggers a manual look at logs.

## 11. Backout plan

- Revert the application PR. The migration is additive (three nullable-default columns); leave it in place. Reverted code ignores the columns.
- If only the filter fail-closed change needs to be undone (e.g. unexpected queue drop-off), a one-line patch restores fail-open while keeping the counter.
