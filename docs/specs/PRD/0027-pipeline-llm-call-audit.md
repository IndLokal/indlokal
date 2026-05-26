# PRD-0027: Per-LLM-call audit & cost telemetry

- **Status:** Approved
- **Owner:** Platform
- **Reviewers:** Eng Lead
- **Linked:** TDD-0027, ADR-0006, PRD-0026

## 1. Problem

The pipeline currently reports LLM usage at _region-run_ granularity: two integers (`llmCalls`, `llmTokensEstimate`) on each `PipelineRun` row. This is insufficient to operate the system in production:

- We cannot answer "what did extraction cost last week" vs. "what did filter cost".
- We cannot answer "which source produced the most expensive batches".
- We cannot answer "why was item X auto-approved at confidence 0.91" - the prompt/response is unrecoverable after the cron function exits.
- A regression in prompt length or batch size is undetectable until the OpenAI invoice arrives.

This is the single highest-ROI observability change in the system per the architecture review.

## 2. Users & JTBD

- **Operator:** "Give me last night's cost split by stage and source."
- **Operator on incident:** "Find the LLM call that produced PipelineItem `xyz`."
- **Future finance reviewer:** "Show me LLM spend trending over 30 days."

## 3. Success Metrics

| Metric                                             | Today                  | Target after rollout                  |
| -------------------------------------------------- | ---------------------- | ------------------------------------- |
| Per-LLM-call audit rows                            | 0                      | 1 row per `callOpenAI` invocation     |
| Time to answer "what did last night cost by stage" | unbounded (impossible) | 1 SQL query                           |
| Lineage from `PipelineItem` → originating LLM call | none                   | `runId + stage + batchIndex` joinable |

## 4. Scope

- New table `PipelineLlmCall` with: `id, runId, stage, model, promptTokens, completionTokens, totalTokens, durationMs, ok, errorCode, batchSize, createdAt`.
- Every `callOpenAI` invocation writes one row, on success and on failure.
- A `runId` is passed through the orchestrator → extraction call chain (replaces the current implicit per-process token counter). The current process-scoped counters (`llmCallCount`, `llmTokenEstimate`) become a thin aggregation over the new rows but are retained as fields on `PipelineRunResult` for back-compat.
- A small admin SQL view (or readme snippet) documenting the canonical "cost by stage by day" query.

## 5. Out of Scope

- Storing prompt/response bodies (privacy + cost). Only metadata. (A future spec can add hash-keyed cold storage if needed.)
- Migration of historical `PipelineRun.llmCalls/llmTokensEstimate` into the new table.
- A UI for browsing the audit log - query via SQL for now.
- Multi-provider abstraction - single-provider (OpenAI) is fine.
- Cost calculation in dollars - token counts only; price tables move; downstream consumer applies pricing.

## 6. User Stories

- As an operator, I want one row in `pipeline_llm_calls` per LLM call so I can write SQL to answer cost and reliability questions.
- As an operator on incident, I want to query `pipeline_llm_calls WHERE runId = ? AND ok = false` to see exactly which calls failed.
- As an engineer changing a prompt, I want a regression in token usage to surface in a query the next morning.

## 7. Acceptance Criteria (Gherkin)

```
Given the pipeline executes a filter batch of 10 items and one extract batch of 3 items
When the run completes
Then 2 rows exist in pipeline_llm_calls for that runId
And both have stage in ('filter','extract') and ok=true
And the sum of totalTokens across the rows equals result.llmTokensEstimate
```

```
Given an LLM call times out
When the run completes
Then a pipeline_llm_calls row exists with ok=false and errorCode='timeout'
And durationMs is approximately the timeout setting
```

```
Given 1000 LLM calls in a 30-day window
When the operator runs the canonical "cost by stage by day" query
Then results return in under 200ms (index on (createdAt, stage))
```

## 8. UX

No user-facing UX. Admin docs gain one section under `docs/architecture-review/` with the canonical SQL.

## 9. Risks & Open Questions

- **Risk:** Per-call DB writes add latency to the cron function. **Mitigation:** Writes are fire-and-forget (`void db.pipelineLlmCall.create(...).catch(...)`); failure to audit does not block pipeline progress. Average cost is < 5ms per call against Neon - negligible vs. 1-5s LLM latency.
- **Risk:** Table grows unboundedly. **Mitigation:** Retention of 90 days is sufficient for operations; a cleanup cron is a follow-up (out of scope here). At ~30-50 calls/day × 90 days × ~200 bytes/row this is < 1 MB - non-issue at current scale.
- **Open:** Should we capture the source URL alongside `runId`? **Decision:** No, not in this iteration - the LLM call processes a _batch_, not a single source. `batchIndex` + `runId` + the existing per-batch logs are sufficient for lineage. A future `PipelineSourceRun` table (separate PRD) provides the source dimension cleanly.
