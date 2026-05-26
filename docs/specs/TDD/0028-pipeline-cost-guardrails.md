# TDD-0028: Pipeline cost guardrails

- **Status:** Approved
- **Linked PRD:** PRD-0028
- **Owner:** Platform

## 1. Architecture overview

A single small `LlmBudget` object is created per `runPipeline` invocation, held in module state inside `extraction.ts` (same scope as the existing token counters), and consulted at the start of every `callOpenAI`. Two trip conditions:

1. **Token budget exceeded** - cumulative tokens (input + output, summed across all calls in this run) ≥ `PIPELINE_RUN_TOKEN_BUDGET`.
2. **Circuit open** - `PIPELINE_CIRCUIT_BREAKER_THRESHOLD` consecutive failures.

Either condition throws a typed error. The orchestrator catches at the stage boundary, records the trip on `result`, and bails on subsequent stages.

```
callOpenAI()
  ├── budget.checkBeforeCall()  ← throws if tripped, no HTTP
  ├── fetch(...)
  ├── on success: budget.recordSuccess(tokens)
  └── on failure: budget.recordFailure(); rethrow
```

## 2. Data model changes

```prisma
model PipelineRun {
  // ...existing...
  budgetExceeded         Boolean @default(false) @map("budget_exceeded")
  circuitBreakerTripped  Boolean @default(false) @map("circuit_breaker_tripped")
}
```

Migration: `20260526180000_add_pipeline_cost_guard_flags` - two `ALTER TABLE pipeline_runs ADD COLUMN ... BOOLEAN NOT NULL DEFAULT false`.

## 3. API surface

No new HTTP endpoints. Cron `result` body gains two booleans (back-compat: additive). `PostHog PIPELINE_SHARD_COMPLETED` event gains `budget_exceeded` and `circuit_breaker_tripped`.

## 4. Module changes

### 4.1 `extraction.ts` - new `LlmBudget`

```ts
export class PipelineBudgetExceededError extends Error {
  readonly code = 'budget_exceeded' as const;
  constructor(
    readonly tokensConsumed: number,
    readonly limit: number,
  ) {
    super(`Pipeline token budget exceeded: ${tokensConsumed} > ${limit}`);
  }
}

export class PipelineCircuitOpenError extends Error {
  readonly code = 'circuit_open' as const;
  constructor(readonly consecutiveFailures: number) {
    super(`Pipeline LLM circuit open after ${consecutiveFailures} consecutive failures`);
  }
}

type BudgetState = {
  tokenLimit: number;
  circuitThreshold: number;
  tokensConsumed: number;
  consecutiveFailures: number;
  budgetTripped: boolean;
  circuitTripped: boolean;
};

let budget: BudgetState | null = null;

export function resetLlmBudget(): void {
  budget = {
    tokenLimit: getClampedIntEnv('PIPELINE_RUN_TOKEN_BUDGET', 200_000, 10_000, 10_000_000),
    circuitThreshold: getClampedIntEnv('PIPELINE_CIRCUIT_BREAKER_THRESHOLD', 5, 1, 100),
    tokensConsumed: 0,
    consecutiveFailures: 0,
    budgetTripped: false,
    circuitTripped: false,
  };
}

export function getLlmBudgetStatus() {
  return {
    budgetExceeded: budget?.budgetTripped ?? false,
    circuitBreakerTripped: budget?.circuitTripped ?? false,
    tokensConsumed: budget?.tokensConsumed ?? 0,
  };
}

function assertBudgetAvailable(): void {
  if (!budget) return; // CLI path without orchestrator wrapping - no enforcement
  if (budget.circuitTripped) {
    throw new PipelineCircuitOpenError(budget.consecutiveFailures);
  }
  if (budget.budgetTripped || budget.tokensConsumed >= budget.tokenLimit) {
    budget.budgetTripped = true;
    throw new PipelineBudgetExceededError(budget.tokensConsumed, budget.tokenLimit);
  }
}

function recordCallSuccess(tokens: number): void {
  if (!budget) return;
  budget.tokensConsumed += tokens;
  budget.consecutiveFailures = 0;
  if (budget.tokensConsumed >= budget.tokenLimit) {
    budget.budgetTripped = true;
  }
}

function recordCallFailure(): void {
  if (!budget) return;
  budget.consecutiveFailures += 1;
  if (budget.consecutiveFailures >= budget.circuitThreshold) {
    budget.circuitTripped = true;
  }
}
```

`resetLlmStats()` also calls `resetLlmBudget()` so existing callers (CLI, tests) get sensible defaults.

`callOpenAI` is wrapped:

```ts
export async function callOpenAI(messages, opts = {}): Promise<string> {
  assertBudgetAvailable(); // throws before any network I/O on a tripped run
  // ...existing fetch + audit-row machinery...
  // on success path:
  recordCallSuccess(tokens);
  // on failure path (in the existing catch before rethrow):
  recordCallFailure();
}
```

### 4.2 `orchestrator.ts` - handle trips at stage boundaries

Wrap each LLM-bearing stage:

```ts
try {
  await timePipelineStage(result, 'filter', () => filterRelevantItems(...));
} catch (err) {
  if (err instanceof PipelineBudgetExceededError) {
    result.budgetExceeded = true;
    result.errors.push(`budget_exceeded:tokens=${err.tokensConsumed}`);
    // Skip remaining LLM stages but still persist what we have.
  } else if (err instanceof PipelineCircuitOpenError) {
    result.circuitBreakerTripped = true;
    result.errors.push(`circuit_breaker_tripped:consecutive_failures=${err.consecutiveFailures}`);
  } else {
    throw err;
  }
}
```

Each subsequent stage checks `result.budgetExceeded || result.circuitBreakerTripped` and skips if set. The final `PipelineRun.update()` writes both booleans.

The `runPipeline` start path calls `resetLlmStats()` which now also resets the budget - no per-stage reset needed.

### 4.3 `types.ts`

```ts
export type PipelineRunResult = {
  // ...existing...
  budgetExceeded: boolean;
  circuitBreakerTripped: boolean;
};
```

### 4.4 Cron route + PostHog payload

Adds the two booleans to the `captureServerEvent` call. No other change.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None. Both knobs are env-only:

- `PIPELINE_RUN_TOKEN_BUDGET` (default 200,000; clamped [10,000 .. 10,000,000])
- `PIPELINE_CIRCUIT_BREAKER_THRESHOLD` (default 5; clamped [1 .. 100])

A budget of 10M effectively disables the cap; operators can set this if a one-off run legitimately needs more.

## 7. Observability

- Two new booleans on `PipelineRun`.
- Two new fields on `PIPELINE_SHARD_COMPLETED` PostHog event.
- Errors array on `PipelineRun` carries the trip reason (`budget_exceeded:...` / `circuit_breaker_tripped:...`), making it grep-able from existing dashboards.
- Two new structured log lines at `warn`:
  - `[Pipeline] budget exceeded (tokens=X > limit=Y); halting LLM stages`
  - `[Pipeline] circuit breaker tripped after N consecutive failures; halting LLM stages`

## 8. Failure modes & fallbacks

| Failure                                            | Old behaviour                       | New behaviour                                                                                                               |
| -------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| One run balloons to 50× cost                       | Silent                              | Aborts at the budget; persists what's done                                                                                  |
| OpenAI down for 5 minutes                          | Retries through entire 300s timeout | Trips circuit within 30s of first failure                                                                                   |
| `PIPELINE_RUN_TOKEN_BUDGET=0` set by accident      | n/a                                 | Clamped up to 10,000; warn logged                                                                                           |
| Budget tripped between filter and extract          | n/a                                 | Extract skipped; what filtered cleanly is dropped (no half-extract DB writes). Next run re-processes via existing URL dedup |
| Circuit tripped after 3 successes, then 5 failures | n/a                                 | Trip is correct (consecutive count); reset only on success                                                                  |

## 9. Test plan

Unit (vitest, `__tests__/extraction.test.ts`):

- `assertBudgetAvailable` throws `PipelineBudgetExceededError` when `tokensConsumed >= limit`.
- `assertBudgetAvailable` throws `PipelineCircuitOpenError` when `consecutiveFailures >= threshold`.
- `recordCallSuccess` resets `consecutiveFailures`.
- `recordCallFailure` trips circuit at exactly the threshold.
- `resetLlmBudget` clears all state.

No DB integration test required (boolean columns are trivially additive).

## 10. Rollout plan

Single deploy with default budgets. Default `200_000` tokens/run is ~3× nominal observed usage in the largest current region - generous safety margin, will not trip on healthy days.

Watch for one week:

- Any `PipelineRun.budgetExceeded = true` → operator investigates whether nominal cost grew (regression) or it was a real bad run.
- Any `PipelineRun.circuitBreakerTripped = true` → cross-reference with OpenAI status page.

If nominal cost grows past 70 % of the cap for legitimate reasons, raise the env var; do not lower the cap.

## 11. Backout plan

- Setting both env vars to their clamp ceilings effectively disables enforcement without code change.
- Code revert is one PR (booleans on `PipelineRun` are additive and harmless if left in the schema).
