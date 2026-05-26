# PRD-0026: Pipeline reliability hardening (Phase 0)

- **Status:** Approved
- **Owner:** Platform
- **Reviewers:** Eng Lead
- **Linked:** TDD-0026, ADR-0006, [docs/architecture-review/AI_PIPELINE_ARCHITECTURE_REVIEW.md](../../architecture-review/AI_PIPELINE_ARCHITECTURE_REVIEW.md)

## 1. Problem

The content ingestion pipeline currently degrades **silently and dangerously** under partial-failure conditions:

1. **Filter stage fails open.** When OpenAI returns an error or times out, `filterRelevance()` marks _every_ item in the batch as relevant. Those items then flow into the expensive extract stage, which also fails, also burns tokens, and queues low-quality items. The filter's safety property is inverted on failure.
2. **Recursive batch split has no budget.** During a sustained LLM outage, `extractBatch()` keeps halving and retrying until single-item depth, burning the entire 300s cron budget producing zero output.
3. **Cron retries are not idempotent.** A GitHub-Actions retry, a manual `workflow_dispatch` during a scheduled window, or a Vercel function timeout will re-run the entire region. LLM tokens are spent twice; race conditions occur on `PipelineItem` inserts.
4. **Env knobs are unbounded.** A typo like `PIPELINE_EXTRACT_BATCH_SIZE=300` is silently accepted and will stuff ~900K characters into one prompt.
5. **Out-of-range LLM indices silently mis-attribute items.** If the LLM returns an absolute index outside the current batch range, `normalizeSourceIndex` falls back to `startIndex`, attaching the extracted item to the _first_ source in the batch. The wrong source is then audited as the origin.

These are not theoretical - they are reachable today by an OpenAI tier-1 rate-limit spike or a single GHA missed-then-retried run.

## 2. Users & JTBD

- **Pipeline operator (today: founder):** "When something goes wrong, I want the pipeline to fail loud and cheap, not silently and expensive."
- **Admin reviewer:** "I want to trust that items in my queue are real candidates, not the residue of an LLM outage."
- **Finance (later):** "I want a runaway LLM bill to be impossible from a single bad config."

## 3. Success Metrics

| Metric                                      | Today                          | Target after rollout           |
| ------------------------------------------- | ------------------------------ | ------------------------------ |
| `PipelineRun.filterFailures` populated      | n/a                            | new field; ≥ 0 visible per run |
| Items queued during an LLM-outage window    | proportional to fetched volume | **0** (filter drops batch)     |
| Cost of a worst-case extract retry storm    | unbounded inside 300s          | capped by `RetryBudget`        |
| Duplicate region runs in a 30-min window    | possible                       | rejected with HTTP 409         |
| LLM index mis-attribution silently accepted | always                         | logged and dropped             |

Measured via the new `PipelineRun` fields (`filterFailures`, `extractRetriesExhausted`, `itemsDroppedBadIndex`) and the new `PipelineLlmCall` table (PRD-0027).

## 4. Scope

- Filter fail-closed: on LLM error, return `[]` (skip batch) and increment a counter.
- Per-batch `RetryBudget` (max recursion depth + max wall-clock ms) for `extractBatch`.
- Clamp `PIPELINE_FILTER_BATCH_SIZE`, `PIPELINE_EXTRACT_BATCH_SIZE`, `PIPELINE_LLM_TIMEOUT_MS` to documented safe bands; log a warning on clamp.
- Reject items whose normalized LLM index falls back to `startIndex`; count them in a new `itemsDroppedBadIndex` field.
- Postgres advisory lock per `(scope-key)` taken at the top of `runPipeline()`; cron handler returns HTTP 409 when not acquired.
- Three new counters on `PipelineRunResult` and `PipelineRun`: `filterFailures`, `extractRetriesExhausted`, `itemsDroppedBadIndex`.

## 5. Out of Scope

- Job queue migration (Inngest / pg-boss) - deferred to a later spec.
- Per-LLM-call audit table - covered by PRD-0027.
- Prompt-injection / URL-allowlist hardening - deferred.
- Notification outbox processor - owned by TDD-0002.
- Documentation rename of `AI_PIPELINE_*.md` - covered by ADR-0006.

## 6. User Stories

- As an operator, when OpenAI returns 429 for 5 minutes, I want the pipeline to log a structured failure and **stop** queuing items rather than dump unfiltered content into the review surface.
- As an operator, when a cron run is accidentally triggered twice, I want the second invocation to no-op cleanly with HTTP 409, not double-bill OpenAI.
- As an operator, when I set a bad env var, I want a clamp warning in logs, not a 900K-char prompt sent to OpenAI.

## 7. Acceptance Criteria (Gherkin)

```
Given the OpenAI API is returning 5xx for every request
When the filter stage runs against 10 fetched items
Then no items are passed to the extract stage
And result.filterFailures equals 1
And the items are not queued to PipelineItem
```

```
Given a pipeline run is already in progress for region=berlin
When a second POST /api/cron/pipeline?region=berlin arrives
Then the second response is HTTP 409 with body { ok: false, reason: 'locked' }
And no second PipelineRun row is created
```

```
Given PIPELINE_EXTRACT_BATCH_SIZE is set to 999
When the extraction module initialises
Then the effective batch size is clamped to the documented maximum
And a warning is logged including both the requested and clamped values
```

```
Given the LLM returns index=99 inside a batch of 3 items starting at index 10
When the extracted item is normalised
Then the item is dropped (not attributed to startIndex)
And result.itemsDroppedBadIndex is incremented
```

```
Given the extract LLM has been failing for 90s of wall-clock retries
When the RetryBudget is exhausted
Then no further recursive split calls are made
And result.extractRetriesExhausted is incremented
And the pipeline run completes with whatever items were extracted before exhaustion
```

## 8. UX

No user-facing UX. Admin `/admin/pipeline` keeps current shape; new counters surface in the run-detail JSON for future dashboarding.

## 9. Risks & Open Questions

- **Risk:** Switching the filter from fail-open to fail-closed reduces queue volume during real LLM degradations. **Mitigation:** Operator alert on `filterFailures > 0` so degradations are noticed and the fetched URLs can be retried in the next scheduled window.
- **Risk:** Advisory lock collides with developers running `pnpm pipeline` locally against a shared DB. **Mitigation:** Lock key namespaced to `pipeline:<scope>`; CLI passes a `runId` that uses a different lock namespace (`pipeline-cli:<scope>`), so cron and CLI cannot deadlock each other.
- **Open:** Should the clamp throw or warn-and-clamp? **Decision:** warn-and-clamp - keeps the pipeline running with a sane default; throwing would break cron until env is fixed.
