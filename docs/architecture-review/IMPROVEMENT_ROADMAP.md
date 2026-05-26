# AI Pipeline — Improvement Roadmap

Phased. Each phase is independently shippable and produces measurable improvement.
References: [AI_PIPELINE_ARCHITECTURE_REVIEW.md](AI_PIPELINE_ARCHITECTURE_REVIEW.md), [RISK_REGISTER.md](RISK_REGISTER.md).

---

## Phase 0 — Stop the bleeding (this sprint)

**Goal:** Eliminate silent-degradation failure modes. Zero new infra.

| #   | Change                                                                                                                                | File(s)                                                                                         | Risk addressed | Effort                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------- | -------------------------------- |
| 0.1 | Filter fail-closed: on LLM error, return `[]` (drop batch), increment `result.filterFailures`, log structured `pipeline.filter.error` | `extraction.ts` `filterRelevance()`                                                             | R1             | 1 h                              |
| 0.2 | Advisory lock per region/scope in cron handler                                                                                        | `cron/pipeline/route.ts` + new `src/lib/db/advisory-lock.ts`                                    | R2             | 2 h                              |
| 0.3 | `RetryBudget` threaded through recursive batch split; halt when exhausted                                                             | `extraction.ts` `extractBatch()`                                                                | R3             | 2 h                              |
| 0.4 | Clamp `PIPELINE_*` env knobs to safe bands; warn on clamp                                                                             | `extraction.ts` `getPositiveIntEnv`                                                             | R12            | 30 min                           |
| 0.5 | Validate normalized LLM index — reject items that fall back to `startIndex`; log mismatch                                             | `extraction.ts` `normalizeSourceIndex` callsites                                                | R16            | 1 h                              |
| 0.6 | Rename "Agent" → "Pipeline" in docs; add 1-page ADR                                                                                   | `docs/AI_PIPELINE_*.md` → `docs/AI_PIPELINE_*.md` + `docs/specs/ADR/0001-pipeline-not-agent.md` | R14            | 2 h                              |
| 0.7 | Delete or wire notification outbox processor (decide which)                                                                           | `apps/web/src/modules/notifications/outbox.ts`                                                  | R15            | 1 h decision + 2–4 h either path |

**Definition of done:** all PRs merged; one shadow run on production with `filterFailures` and `retryBudgetExhausted` counters appearing in `PipelineRun`.

**Effort total:** ~1.5 engineer-days.

---

## Phase 1 — Observability & forensics (next sprint)

**Goal:** Be able to answer "what did the pipeline do last night and what did it cost" without reading function logs.

| #   | Change                                                                                                                                                                                                                        | Risk addressed |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.1 | **New table `PipelineLlmCall`**: `id, runId, sourceId?, stage(filter/extract/dedup/enrich/keyword), model, promptTokens, completionTokens, durationMs, ok, errorCode?, createdAt`. Write one row per `callOpenAI` invocation. | R10            |
| 1.2 | **New table `PipelineSourceRun`**: `id, runId, sourceUrl, sourceType, itemsFetched, itemsExtracted, itemsQueued, durationMs, errorCount`.                                                                                     | R10            |
| 1.3 | `contentHash` (sha256 of normalized first 8KB) on `RawContent` and `PipelineItem`. Use in dedup _in addition to_ URL.                                                                                                         | R6             |
| 1.4 | Replace `console.*` in `pipeline/*` with pino-style structured logger. Ship to Axiom (or Vercel→Logflare).                                                                                                                    | R11            |
| 1.5 | Two PostHog alerts: `filter_fail_rate > 5%`, `auto_approval_disagreement > 20%` (needs 1.7).                                                                                                                                  | R1, R7         |
| 1.6 | Admin UI: per-run page showing `PipelineSourceRun` + `PipelineLlmCall` breakdown, cost summary.                                                                                                                               | R10            |
| 1.7 | `wouldAutoApprove` shadow flag on `PipelineItem`. Weekly cron compares against actual human decisions.                                                                                                                        | R7             |

**Effort total:** ~5 engineer-days.

**Outcome:** Reviewable cost dashboard. Threshold tuning becomes data-driven, not vibes.

---

## Phase 2 — Real job queue (next month)

**Goal:** Decouple triggering from execution. Remove the 300s ceiling.

**Recommendation:** **Inngest** — keeps Vercel-only deploy story, native retries/concurrency, free tier covers MVP. Alternative: **pg-boss** if avoiding vendors matters more than DX.

| #   | Change                                                                                                                                                                                        | Risk addressed |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 2.1 | One cron entry → `/api/cron/pipeline/dispatch` reads enabled regions from `pipeline_source_configs` and enqueues `pipeline.region.run` per region. Delete 4 region-specific cron YAML blocks. | R9             |
| 2.2 | `pipeline.region.run` → plans sources → enqueues `pipeline.source.fetch` per source (concurrency-limited).                                                                                    | R5             |
| 2.3 | `pipeline.source.fetch` → emits `pipeline.batch.extract` events with raw content.                                                                                                             | R5             |
| 2.4 | `pipeline.batch.extract` → LLM extract + resolve + dedup + insert. Per-job retry with exponential backoff. Dead-letter to `PipelineFailedJob` table after 3 attempts.                         | R3, R5         |
| 2.5 | `pipeline.community.dedup` (post-queue, async) — moves semantic dedup out of sync orchestrator path.                                                                                          | R8             |
| 2.6 | Global token-bucket rate limit on `callOpenAI` (60/min default, env-tunable).                                                                                                                 | R17            |
| 2.7 | Per-region time-budget metric: alert if region run > 30 min wall-clock.                                                                                                                       | R5             |

**Effort total:** ~10 engineer-days.

**Outcome:** Pipeline can scale to 10–20 regions and 5–10× current volume without architectural change. LLM cost becomes globally throttleable.

---

## Phase 3 — Trust & safety hardening (post-queue)

**Goal:** Make auto-approval safe to widen.

| #   | Change                                                                                                                                           | Risk addressed    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 3.1 | Delimit untrusted source text in user message with explicit `<<<UNTRUSTED>>>...<<<END>>>` markers and reinforced system instruction.             | R4                |
| 3.2 | URL safety: registration URL must share eTLD+1 with source URL **OR** be on an allow-list (eventbrite/meetup/etc.) to qualify for auto-approval. | R4                |
| 3.3 | pg_trgm index on `Community.name`; semantic LLM dedup only fires in ambiguous score band.                                                        | R8                |
| 3.4 | Optimistic-locking guard on `PipelineItem.status` transitions (`WHERE status = 'PENDING'` in update).                                            | R20               |
| 3.5 | Move auto-approval thresholds from code constants to `pipeline_source_configs` (per source-type).                                                | (3.9 in main doc) |
| 3.6 | Honor `endsAt` strictly in `scores` cron; make 4h default configurable per category.                                                             | R19               |

**Effort total:** ~4 engineer-days.

---

## Phase 4 — LLM provider abstraction (only when justified)

**Do not build until:** OpenAI has had a > 4h outage that affected you, OR you need a model OpenAI doesn't offer (e.g. larger context for full-page extract), OR cost demands tier-routing.

| #   | Change                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------ |
| 4.1 | `LlmClient` interface (`complete(messages, opts) → { content, usage }`).                               |
| 4.2 | Adapters: `OpenAiClient`, `AnthropicClient`. Per-stage routing config (filter→cheap, extract→capable). |
| 4.3 | Fallback chain: primary fails → secondary.                                                             |

**Do not** add embeddings, vector DB, or RAG unless a concrete user-facing product feature requires them. Trigram + LLM dedup is sufficient for current shape.

---

## Phase 5 — If you actually want an agent (optional, future)

This is **not** for the pipeline. The pipeline should stay deterministic. An agent surface, if you want one, is a separate product:

- Admin assistant: "find me communities in Hesse missing a website" → tool-calling over Prisma.
- Reviewer assistant: "summarize the 12 pending items for Munich and propose merges."

If you do this, do **not** put it in `apps/web/src/modules/pipeline/`. New module: `apps/web/src/modules/admin-agent/`. Different lifecycle, different SLAs, different cost model.

---

## What NOT to do

- ❌ Do not add a vector DB / embeddings just because every AI codebase has one. Trigram + LLM is sufficient.
- ❌ Do not move to Vercel Cron from GHA — GHA gives you retries, manual dispatch, and audit history that Vercel Cron does not.
- ❌ Do not split the pipeline into microservices. The module boundaries are correct; the _queue_ is what's missing.
- ❌ Do not rewrite extraction prompts unless you have shadow-eval infrastructure (Phase 1.7). Otherwise you're tuning blind.
- ❌ Do not upgrade to gpt-4o or gpt-4-turbo as default. The cost delta is large and the quality delta on this task is small. Reserve for failures/escalation only.
- ❌ Do not add real-time / webhook ingestion before the queue exists. Webhooks without a queue is a foot-gun.

---

## Sequencing rationale

Phase 0 is mandatory and small — it removes silent failure.
Phase 1 must precede Phase 2: you cannot operate a queued system without per-call telemetry.
Phase 3 must precede any widening of auto-approval.
Phase 4 is conditional, not scheduled.
Phase 5 is a separate product, not a pipeline change.

**Total committed work (Phases 0–3):** ~3 sprints of one engineer.
**Outcome:** moves the system from "MVP, well-shaped" to "production-grade for 5–10× current volume."
