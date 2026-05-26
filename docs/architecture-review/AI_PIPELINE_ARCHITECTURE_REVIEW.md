# IndLokal AI Pipeline - Principal Architect Review

**Date:** 2026-05-26
**Scope:** `apps/web/src/modules/pipeline/*`, `apps/web/src/app/api/cron/*`, `.github/workflows/cron.yml`, `prisma/schema.prisma` (pipeline models), `docs/AI_PIPELINE_*.md`.
**Stance:** Architect view, not code review. Calibrated for "scaling and operating in production," not for MVP-survival.

> TL;DR - The system is **a deterministic ETL pipeline with two LLM calls (filter + extract), persisted in Postgres, scheduled via GitHub Actions, executed inside a Vercel HTTP function**. It is well-suited to current scale (low hundreds of items/day, 4 regions). It is **mis-labelled as an "Agent"**, has **no real queue**, has **dangerous fallback semantics under LLM failure**, and will hit a **hard ceiling at the next 5-10× of volume**. None of those are emergencies. Two of them (filter fail-open, no idempotency on cron retries) should be fixed this sprint.

---

## 1. What is actually built (ground truth)

```
GitHub Actions cron ──HTTP POST──▶ /api/cron/pipeline?region=X
                                          │
                                          ▼
                          runPipeline(triggeredBy, scope)
                                          │
        ┌──────────────┬──────────────┬───┴──────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼              ▼
     PLAN           FETCH         PREFILTER     LLM FILTER     LLM EXTRACT    RESOLVE/DEDUP
  source-plan.ts  sources.ts +   regex+score   gpt-4o-mini    gpt-4o-mini   city resolution
  runtime-config  db-sources.ts  freshness.ts  batch=10       batch=3       + semantic dedup
                  calendar.ts                  fallback=PASS  fallback=SPLIT (LLM)
                                                                                    │
                                                                                    ▼
                                                                          db.pipelineItem.create
                                                                          (PENDING / auto-approved)
                                                                                    │
                                                                                    ▼
                                                                          /admin/pipeline (human)
```

- **No agent.** No tool calls, no loop, no planner LLM. The LLM is a _function_ called twice per item.
- **No queue.** `PipelineItem` is a _review staging table_, not a job queue. There is no worker pool, no retry table, no DLQ. The "outbox" pattern exists for notifications but is unprocessed.
- **No persistent state for in-flight work.** If the Vercel function dies at 299s, anything in memory is lost; only items already INSERTed survive.
- **One LLM provider** (OpenAI, raw `fetch`), one model (`gpt-4o-mini`), one temperature (0.1), JSON-mode.
- **GitHub Actions for cron, not Vercel Cron.** Sharded into 4 regional jobs at 2:05/2:20/2:35/2:50 UTC.

This is fine for MVP. The problems start when you call it an "agent platform."

---

## 2. Architectural verdict

| Dimension                | Grade  | One-line verdict                                                                                                                            |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline structure (DAG) | **B+** | Clear stages, good separation `source-plan` ↔ `orchestrator` ↔ `extraction`. Recent refactor (2026-05-22) was the right call.               |
| Source planning          | **A−** | DB-backed `pipeline_source_configs` with JSON fallback is genuinely well-designed. Keep.                                                    |
| LLM call layer           | **C**  | Raw `fetch`, hand-rolled retry, no SDK, no streaming, no cost ceiling, fail-open on filter.                                                 |
| Queueing & async         | **D**  | There is no queue. Calling `PipelineItem` a queue is wishful.                                                                               |
| Cron design              | **C+** | GHA + Bearer secret is fine. Manual region-sharding is a code smell - it papers over the 300s Vercel ceiling instead of solving it.         |
| Failure handling         | **C−** | Soft-fail-everywhere + fail-open filter + unbounded recursive split = silent degradation under partial outage.                              |
| Observability            | **D+** | `console.log` + one summary row in `PipelineRun`. No traces, no per-item lineage, no alerts.                                                |
| Cost efficiency          | **B+** | Cheapest model, batching, prefilter, opt-in DDG, scope sharding. Genuinely tight.                                                           |
| Idempotency              | **C**  | URL-based dedup at insert is OK. Cron retries (GHA reruns) will double-process. No run-level idempotency key.                               |
| Doc ↔ code alignment     | **D**  | `docs/AI_PIPELINE_ARCHITECTURE.md` and product framing describe an _agent_; code is an ETL. This will burn a future engineer (or investor). |

**Overall:** **C+ / B−**. Correct for current load, dangerous when traffic, autonomy, or team size grows.

---

## 3. Issues, ranked by blast radius

Each item below: **Problem → Why it matters → What breaks at scale → Fix**.

---

### 3.1 🔴 CRITICAL - Filter stage fails _open_ on LLM error

**Where:** [apps/web/src/modules/pipeline/extraction.ts](apps/web/src/modules/pipeline/extraction.ts) - `filterRelevance()` catch block returns `isRelevant: true` for every item in the batch on any LLM error.

**Problem.** When OpenAI returns 429/5xx, has a bad API key, or the network blips, the filter says "everything is relevant." Those items then flow into the _expensive_ extract stage, which will also fail, also burn tokens on retries, and queue garbage if it partially succeeds.

**Why it matters.** This inverts the safety property of the filter. The filter exists _to save money and reduce noise_; on failure it does the opposite. A single bad deploy of OpenAI API key or a regional 429 storm will:

1. 10× your LLM cost for the affected run
2. Pollute the admin review queue with low-quality items
3. Hide the actual failure under "soft" log lines

**At scale.** A multi-hour OpenAI outage in 2026-Q4 (Anthropic and OpenAI have both had these) silently dumps thousands of irrelevant items into the review queue. Human reviewers cannot tell apart "LLM said relevant" from "LLM was down."

**Fix.**

- On filter failure, **drop the batch**, do not pass it through.
- Tag the source for re-fetch in the next run (mark a `nextRetryAt` on the source row).
- Emit a single structured error event and increment a `filterFailures` counter on `PipelineRun`.

---

### 3.2 🔴 CRITICAL - Cron retries are not idempotent

**Where:** [apps/web/src/app/api/cron/pipeline/route.ts](apps/web/src/app/api/cron/pipeline/route.ts), `runPipeline()`.

**Problem.** A cron job that times out at 300s, or a GHA retry, will re-run the entire pipeline. Dedup catches _URL_ duplicates against already-inserted `PipelineItem`s, but:

- LLM tokens for filter + extract are spent _again_
- Semantic dedup LLM calls run _again_ against the same incoming items
- `PipelineRun` history gets duplicate rows with the same trigger window

**Why it matters.** GitHub Actions cron has documented missed/duplicate runs. Vercel function timeouts will happen. There is no run-key, no advisory lock, no "is a run already in progress for region X" guard.

**At scale.** Concurrent cron runs (manual `workflow_dispatch` + scheduled) double-bill OpenAI and create write contention on `PipelineItem`. With 100+ communities, the `IN (...)` semantic dedup query becomes a hot path.

**Fix.**

- Take an **advisory lock per region** at the top of `runPipeline()` (`pg_try_advisory_lock(hashtext('pipeline:' || region))`). If not acquired, return 409 immediately.
- Add a `runKey = sha1(region + dateBucket)` to `PipelineRun` with a unique constraint; insert _first_, abort if conflict.

---

### 3.3 🔴 CRITICAL - Recursive batch-split has no global budget

**Where:** `extractBatch()` recursive halving in `extraction.ts`.

**Problem.** A consistently failing LLM (timeout, 429) causes O(N) leaf calls of size 1. With batch=24 incoming items, a sustained outage triggers up to ~48 retry calls _per batch_, all hitting the 120s timeout. The cron function eats its 300s ceiling on retries and never reaches downstream stages.

**At scale.** First sustained OpenAI degradation = zero pipeline output for that window. No alert, just an empty `itemsExtracted=0` row.

**Fix.**

- Pass a `RetryBudget { remainingMs, remainingCalls }` through the recursion. Halt when exhausted.
- Add an **outer circuit breaker**: 3 consecutive 5xx → trip for the rest of the run, return early, log `pipeline.llm.circuit_open`.

---

### 3.4 🟠 HIGH - There is no queue, but the system pretends there is

**Where:** Architecture-wide. `PipelineItem` is a review queue, not a job queue. Notifications outbox has no processor.

**Problem.** Every unit of work - fetching, LLM-extracting, semantic-deduping, enriching - happens **inline inside the Vercel HTTP cron handler**. The 300s function timeout _is_ your scheduler, your worker, and your concurrency limit, all at once.

**Why it matters.** This conflates three orthogonal concerns:

1. _Triggering_ (cron)
2. _Coordination_ (which sources, which order)
3. _Execution_ (HTTP fetch, LLM call, DB write)

You cannot independently scale, retry, or observe any of them. You cannot drain a queue. You cannot delay an enrichment 1h to amortize cost. You cannot re-process a single failed item without re-running the entire region.

**At scale (anything > 5-10 regions or > ~1000 items/run).**

- Vercel function timeout becomes the hard ceiling. The current "fix" is to spawn more cron _shards_ in `cron.yml`. This does not compose past ~10 shards.
- Concurrent LLM calls cannot be globally rate-limited.
- A single bad source can starve the entire region's run.

**Fix (phased).**

- **Short-term:** Move to **Inngest** or **pg-boss** for job orchestration. Both are MVP-friendly, low-ops. Inngest is the right call if you already use Vercel (no extra infra). pg-boss if you want zero new vendors.
- One job per _source_, one job per _extract batch_, one job per _semantic dedup check_. Run cron just _enqueues_ the planning step.
- Retries, timeouts, concurrency, dead-letters become free.

This is the single biggest architectural lever in the system.

---

### 3.5 🟠 HIGH - Observability is too thin to operate

**Where:** Everywhere. Pattern is `console.log('[Pipeline] ...')` + one summary row in `PipelineRun`.

**Problem.** You cannot answer the following from production today:

- "Which source produced the 12 items that got auto-approved last night?"
- "What was the LLM token cost for the Bavaria run on 2026-05-25?"
- "Which extract batches timed out this week?"
- "Show me the prompt + response for PipelineItem `xyz`."

The `PipelineRun` table aggregates to _region-run_ granularity. Per-item lineage is lost the moment the function exits.

**At scale.** First time a reviewer asks "why was this item auto-approved with confidence 0.91", you cannot answer. First time finance asks "what did this cost", you guess.

**Fix.**

- Add `PipelineSourceRun` (one row per source per run: bytes, items, errors, duration).
- Add `PipelineLlmCall` (one row per LLM call: stage, model, prompt*tokens, completion_tokens, duration_ms, ok, error, runId, sourceId, batchSize). This is the \_single highest-leverage* observability change.
- Persist prompt + response _hash_ (not body) on `PipelineItem` for forensics. Body in cold storage (S3/Blob) keyed by hash, behind a feature flag.
- Replace `console.log` with a structured logger (pino) emitting JSON. Vercel + Logflare/Axiom ingests this natively.
- Wire two PostHog/metric alerts: `filter_fail_open_rate > 5%`, `extract_circuit_open == true`.

---

### 3.6 🟠 HIGH - Doc/code drift on "Agent"

**Where:** `docs/AI_PIPELINE_ARCHITECTURE.md`, `docs/AI_PIPELINE_PRODUCT.md`, in-code comments referring to "agent."

**Problem.** The system has zero agentic properties: no tool-calling loop, no planner, no reflection, no memory beyond a Postgres staging table. Documentation calls it an "AI Content Agent."

**Why it matters.** This is not pedantry. It will cause:

- A future engineer to add an agentic loop "to match the docs," massively increasing cost and latency.
- A new hire to look for tool abstractions that do not exist.
- An investor/partner to mis-scope an integration.

**Fix.** Rename to "Content Discovery Pipeline" in docs. Reserve "Agent" for an actual future agentic surface (e.g., admin-facing assistant). One PR, half a day.

---

### 3.7 🟠 HIGH - Region sharding via cron.yml is the wrong abstraction

**Where:** `.github/workflows/cron.yml` (4 entries: Berlin, BaWü, Bavaria, Hesse), `parseScopeParam()` in `cron/pipeline/route.ts`.

**Problem.** The region list is duplicated in code (`pipeline_source_configs` table) and in YAML (4 hard-coded cron entries). Adding a 5th region requires a YAML edit + redeploy. Coverage is uneven (Hesse and BaWü do not need the same budget as Berlin).

**At scale.** With 10+ regions, this becomes 10+ near-identical YAML blobs and untunable per-region timing.

**Fix.**

- One cron entry that POSTs `/api/cron/pipeline/dispatch` (no body).
- That endpoint reads enabled regions from `pipeline_source_configs`, enqueues one job per region via Inngest/pg-boss (or just `fetch`-and-forget to itself with `region=X`).
- Per-region duration/budget configurable in DB.

---

### 3.8 🟡 MEDIUM - No content hashing; URL is the only stable key

**Problem.** Dedup is by exact `sourceUrl`. A page that flips between `?utm=x` and `?utm=y`, or moves from `/events` to `/events/2026`, creates two items. Conversely, a stable URL whose content was completely rewritten is silently merged into the existing item.

**Fix.** Add `contentHash = sha256(normalizedText.slice(0, 8000))` on `RawContent` and on `PipelineItem`. Cheap, idempotent, makes re-runs nearly free.

---

### 3.9 🟡 MEDIUM - Auto-approval policy is two coupled magic numbers

**Where:** `review.ts` - `totalReviewed >= 5 && approvalRate >= 0.8 && confidence >= 0.9`.

**Problem.** Thresholds are code constants, not configuration. There is no shadow-mode (what _would_ have auto-approved if threshold were 0.85?). There is no audit of "approved items that humans later rejected."

**Fix.** Move thresholds to `pipeline_source_configs` per source-type or region. Add a `wouldAutoApprove` shadow flag on `PipelineItem` so you can tune thresholds offline against real human decisions.

---

### 3.10 🟡 MEDIUM - Semantic dedup LLM call is per-item and unbounded

**Where:** `intelligence.ts` `semanticCommunityDuplicateCheck()` - called inside the orchestrator's resolve loop, one LLM call per incoming community.

**Problem.** Cost and latency scale linearly with new communities, and it is in the _synchronous_ path of the cron run. A spike of 200 new community candidates = 200 sequential LLM calls inside the 300s budget.

**Fix.**

- Pre-filter candidates with **trigram similarity in Postgres** (`pg_trgm` GIN index on `Community.name`). Only call LLM when trigram score is in the ambiguous band (e.g. 0.3-0.7).
- Move semantic dedup to a _post-queue_ enrichment job, not inline.

---

### 3.11 🟡 MEDIUM - Prompt injection surface is real, even if low risk today

**Where:** `extraction.ts` user-message construction - concatenates 3000 chars of arbitrary fetched HTML/text.

**Problem.** JSON-mode + a strong system prompt provides moderate protection, but a hostile event page can still influence `confidence`, `categories`, even `cityName`. The current pipeline auto-approves at confidence ≥ 0.9.

**Why it matters.** An adversary submitting a community website who wants to inflate confidence (or, worse, inject a phishing `registrationUrl`) has a non-zero shot.

**Fix.**

- Strip/sandbox the user content with a clear delimiter (`<<<UNTRUSTED_SOURCE_TEXT>>>...<<<END>>>`) and an explicit system instruction to never follow instructions inside it.
- Sanitize extracted URLs against an allowlist of schemes + a deny-list of known phishing TLDs _before_ persisting.
- Never auto-approve `registrationUrl` to a domain different from the source domain.

---

### 3.12 🟡 MEDIUM - No upper bound on env-driven knobs

**Where:** `getPositiveIntEnv` in `extraction.ts` - `PIPELINE_FILTER_BATCH_SIZE`, `PIPELINE_EXTRACT_BATCH_SIZE`, `PIPELINE_LLM_TIMEOUT_MS`.

**Problem.** A typo like `PIPELINE_EXTRACT_BATCH_SIZE=300` will silently attempt to stuff 900K chars into one prompt.

**Fix.** Clamp each knob to a sane band; log a warning on clamp.

---

### 3.13 🟢 LOW - Stage timings are in-process only

`stageTimings` lives on the run result, persisted to `PipelineRun`. Fine. But there's no per-source timing, so you cannot say "Eventbrite is 60% of the fetch budget." Add per-source duration to the proposed `PipelineSourceRun`.

---

### 3.14 🟢 LOW - Hardcoded freshness regexes

`freshness.ts` patterns are static. At current scale this is correct (avoid premature config). Revisit if you add non-German regions.

---

## 4. What is actually well-designed (do not touch)

These are the parts where I would push back on any "refactor":

1. **`source-plan.ts` ↔ `orchestrator.ts` split.** The 2026-05-22 refactor that pulled planning out of orchestration is exactly right. Keep policy in `source-plan`, mechanics in `orchestrator`.
2. **DB-backed `pipeline_source_configs` with JSON fallback.** Idempotent bootstrap, per-process cache, falls back when table is empty. Mature design.
3. **Two-stage LLM (cheap filter → richer extract).** Correct cost/quality split. Do not collapse into one call.
4. **Prefilter before filter.** Regex/score-based stale-page detection saves real money. Keep tuning the regexes, don't replace the pattern.
5. **DB-derived sources from community websites.** Compounding asset - every approved community makes future runs better. Genuinely good.
6. **Scope-aware pinned source filtering** (`scope: GENERIC|CITY|REGION` + `hintState`). Right shape for sharded runs.
7. **Strict mode (`PIPELINE_STRICT=1`) opt-in.** Sensible default of tolerant cron + strict CLI.
8. **`runtime-config.ts` single per-process cache.** Avoids re-querying within a run. Right.
9. **Conservative auto-approval thresholds.** They are too rigid (see 3.9) but the _direction_ (very few auto-approvals, mostly human review) is correct for a trust-bootstrap phase.
10. **Bearer-token auth on cron routes** with explicit `if (!process.env.CRON_SECRET)` guard. Correct.

---

## 5. Quick wins (≤ 1 day each)

Ordered by ROI:

1. **Fix filter fail-open** → return empty, not "all relevant" (3.1). 30 min.
2. **Clamp env knobs** to safe bands (3.12). 30 min.
3. **Add advisory lock per region** in cron handler (3.2). 1 h.
4. **Add depth/budget limit** to recursive batch split (3.3). 1 h.
5. **Persist `PipelineLlmCall` rows** for every LLM call (3.5). Half a day. Highest observability ROI in the codebase.
6. **Rename "Agent" → "Pipeline" in docs** (3.6). 1 h.
7. **Add `contentHash`** to `RawContent` and `PipelineItem` (3.8). 2 h.
8. **Trigram pre-filter for semantic dedup** (3.10). Half a day.
9. **Allow-list registration URL domains** against source domain in auto-approval (3.11). 1 h.

That sequence alone moves the system from C+ to B+.

---

## 6. Genuine technical debt vs over-engineering

**Genuine debt (pay down):**

- Fail-open filter
- Cron retry non-idempotency
- No per-LLM-call audit row
- Region YAML duplication
- No content hashing
- Doc/code drift on "Agent"

**Not debt - appropriate for stage (do NOT pay down yet):**

- One LLM provider
- No vector DB / embeddings
- No streaming responses
- No multi-tenancy in pipeline
- No real-time pipeline (cron is fine)
- Hardcoded freshness regexes

**Over-engineering that exists today:**

- `intelligence.ts` enrichment + keyword evaluation modules are wired in but barely used. Either commit and surface them in the admin UI, or delete them. Code that runs in cron but no human reads its output is pure cost.
- The recursive batch-split is clever but solves a problem (LLM partial timeout) that a circuit breaker + smaller batch would solve more simply.

**Under-engineering (the dangerous kind):**

- No real queue (3.4)
- No per-item LLM call log (3.5)
- No alerting on `filter_failures`, `extract_circuit_open`, `auto_approval_disagreement`

---

## 7. Scalability ceiling - concrete numbers

Current architecture supports approximately:

| Axis                       | Today   | Hard ceiling | First thing that breaks                                                   |
| -------------------------- | ------- | ------------ | ------------------------------------------------------------------------- |
| Items / region / run       | ~200    | ~800         | Vercel 300s function timeout during extract                               |
| Regions                    | 4       | ~10          | YAML cron entries become unmanageable; no global LLM rate limit           |
| LLM calls / minute         | ~30     | ~200         | OpenAI tier-1 rate limit (60 req/min on gpt-4o-mini standard); no backoff |
| Concurrent admin reviewers | 1-2     | ~5           | No optimistic locking on `PipelineItem.status` transitions                |
| Cost / month               | ~$40-70 | ~$300        | Linear in items; no per-run cost cap                                      |

To go past these, the queue (3.4) and per-call telemetry (3.5) are non-negotiable.

---

## 8. Architectural assessment (one paragraph)

This is a **well-factored ETL pipeline that has been carefully sized for the present.** It is honest about cost, conservative about autonomy, and the recent planning/orchestration split shows real architectural maturity. It is **not, and should not pretend to be, an agent platform.** Its three real architectural weaknesses are (a) the lack of a job queue conflates triggering with execution, (b) failure modes are silent and biased toward proceeding rather than halting, and (c) observability is too thin for anyone except the original author to operate. Fix those three, in that order, before adding any new "AI feature."

---

## 9. See also

- [RISK_REGISTER.md](RISK_REGISTER.md) - prioritized, with severity × likelihood.
- [IMPROVEMENT_ROADMAP.md](IMPROVEMENT_ROADMAP.md) - phased plan with rough effort.
