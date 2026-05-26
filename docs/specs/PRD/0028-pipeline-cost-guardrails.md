# PRD-0028: Pipeline cost guardrails

- **Status:** Approved
- **Owner:** Platform
- **Linked:** TDD-0028, PRD-0026 (reliability), PRD-0027 (audit)

## 1. Problem

PRD-0026 and PRD-0027 made the pipeline visible and stopped two failure-amplifiers (filter-fail-open, unbounded retry split). They do **not** stop a runaway run. Concretely, today:

- A bad source whose page balloons to 200 KB of text still goes into extract at full size; one run can quietly burn 100× normal tokens.
- A prompt regression that increases output tokens by 5× silently doubles cost; we only learn from the OpenAI invoice.
- A sustained OpenAI 5xx outage causes every batch to retry until the function timeout — the new `RetryBudget` bounds a _single_ batch's split tree but not the sum across many batches in one run.
- There is no daily ceiling. If cron is triggered manually in a loop, we will pay for the loop.

These are the failure modes the architecture review's R3, R10, and R17 jointly point at; PRD-0026 and PRD-0027 covered the observability half. This PRD covers the enforcement half.

## 2. Users & JTBD

- **Operator:** "Tell the pipeline to stop spending if it has already burned its budget for this run."
- **Operator on incident:** "When OpenAI is having a bad day, don't retry into the timeout — bail fast."

## 3. Success Metrics

| Metric                                    | Today                   | Target after rollout                  |
| ----------------------------------------- | ----------------------- | ------------------------------------- |
| Max OpenAI cost for a single pipeline run | unbounded               | ≤ 50× nominal run cost (configurable) |
| Time to fail when OpenAI is unavailable   | 300s (function timeout) | < 30s (circuit-breaker trip)          |
| Re-runs caused by partial-failure runs    | n/a (no visibility)     | tracked; ≤ 1 per week steady-state    |

## 4. Scope

- A **per-run token budget**. Default: 200,000 input + output tokens. Configurable via env (`PIPELINE_RUN_TOKEN_BUDGET`).
- A **circuit breaker** on consecutive `callOpenAI` failures within a run. Default trip after 5 consecutive failures; trip is sticky for the rest of the run. Configurable via env.
- A new error type `PipelineBudgetExceededError` surfaced cleanly through the orchestrator and persisted on `PipelineRun.errors`.
- Two new counter columns on `PipelineRun`: `budgetExceeded` (bool) and `circuitBreakerTripped` (bool).

## 5. Out of Scope

- **Cross-run global rate limiter** (token-bucket across all runs). Tracked as R17, deferred to Phase 2 with the queue. A per-run budget is the right primitive at current scale — there is exactly one cron-driven run per region per ~6 hours; a per-run cap is sufficient.
- **Dollar-denominated budgets.** Token counts are the durable unit; prices move and downstream tooling applies a price table.
- **Adaptive budgets** (learn nominal cost, auto-tune). Premature optimization at one-region scale.
- **Killing in-flight requests on budget exceed.** We check the budget _before_ the next `callOpenAI` call, not via abort. Simpler, deterministic, no half-billed requests.

## 6. User Stories

- As an operator, I want a hard ceiling on how much one pipeline run can spend so that a single bad source or prompt regression cannot drain my OpenAI quota.
- As an operator on an OpenAI-degraded day, I want the pipeline to abort within 30s after 5 consecutive failures rather than retrying the same broken provider for 5 minutes.
- As an engineer, I want a clearly distinguishable `PipelineRun.errors` entry (`"budget_exceeded:tokens=205432"` or `"circuit_breaker_tripped:consecutive_failures=5"`) so I do not confuse a guard trip with a genuine code bug.

## 7. Acceptance Criteria (Gherkin)

```
Given PIPELINE_RUN_TOKEN_BUDGET=100000
And the run has already consumed 100001 tokens
When the next callOpenAI invocation is about to start
Then it throws PipelineBudgetExceededError before any HTTP request
And PipelineRun.budgetExceeded is set to true
And PipelineRun.errors contains "budget_exceeded:tokens=100001"
And the orchestrator stops at the current stage and persists what it has
```

```
Given OpenAI is returning HTTP 500 to every request
And PIPELINE_CIRCUIT_BREAKER_THRESHOLD=5
When the 5th consecutive callOpenAI failure occurs
Then subsequent callOpenAI calls throw PipelineCircuitOpenError immediately (no HTTP)
And PipelineRun.circuitBreakerTripped is set to true
And the run terminates within 30s of the first failure
```

```
Given the circuit has tripped on a previous batch
When a new pipeline run starts
Then the circuit is reset to closed
And budget counters reset to zero
```

## 8. UX

No user-facing UX. Operator-only.

## 9. Risks & Open Questions

- **Risk:** Budget tripping mid-extract leaves the run with extracted items unqueued. **Mitigation:** Orchestrator already persists `PipelineRun` via update() at the end; we add the budget/circuit booleans plus a clear error entry so the operator sees exactly what happened. Re-run will skip already-queued items via the existing URL dedup.
- **Risk:** Circuit-breaker false trips during normal flakiness. **Mitigation:** Threshold defaults to 5 _consecutive_ failures (not 5 failures total). A single success resets the counter.
- **Open:** Should the budget include the prefilter stage (zero LLM)? **Decision:** Budget tracks tokens, prefilter uses none, so it is implicitly free. Stage-level budget split (e.g. 30% filter / 70% extract) is deliberately not added — premature.
- **Open:** Should budget be exposed in the cron route response? **Decision:** Yes, as part of `result` — already mechanically true once orchestrator copies the new counters.
