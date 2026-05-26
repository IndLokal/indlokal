# PRD-0029: Pipeline per-region dispatch (Phase 2 minimal)

- **Status:** Approved
- **Owner:** Platform
- **Linked:** TDD-0029, PRD-0023 (shard standardization), PRD-0025 (cron sharding), architecture-review/IMPROVEMENT_ROADMAP.md §Phase 2

## 1. Problem

Today the GitHub Actions cron schedules four hardcoded entries - one per region (`berlin`, `baden-wuerttemberg`, `bavaria`, `hesse`) - each calling `POST /api/cron/pipeline?region=<id>`. This worked at four regions; it stops working at twenty:

- **Hardcoded fan-out.** Adding a new region requires editing `.github/workflows/cron.yml` (a separate repo deploy) plus the DB seed. Two artefacts must stay in sync.
- **All-or-nothing shards.** When a single region in a shard fails, the entire shard returns HTTP 500 and the cron job is marked failed, even though sibling regions succeeded.
- **Implicit time-budget coupling.** Several regions sharing a shard share a 300s Vercel function budget, so a slow region starves its shard-mates.

The architecture review proposed a full job queue (Inngest or pg-boss) as Phase 2 (R5, R9). That is the right destination but the wrong next step at our scale (today: 4 regions, ~5 minutes/run, ≤ 1 cron tick per day). We don't yet have evidence we need retries, dead-lettering, or persistent state for per-region jobs.

## 2. Users & JTBD

- **Operator adding region #5:** "Enable a region in the admin console and have it picked up by the next cron tick without touching repo YAML."
- **Operator during incident:** "When Bavaria's source returns 500s, retry Bavaria tomorrow without losing Berlin's successful run."

## 3. Success Metrics

| Metric                                                   | Today                         | Target after rollout          |
| -------------------------------------------------------- | ----------------------------- | ----------------------------- |
| GHA cron entries for the pipeline                        | 4 (one per region)            | 1 (dispatcher)                |
| Steps to add a 5th region                                | Edit + deploy `cron.yml` + DB | Enable in DB only             |
| Per-region time budget                                   | shared 300s                   | own 300s                      |
| Per-region run isolation (one failure → others continue) | No (HTTP 500 fails the shard) | Yes (independent invocations) |

## 4. Requirements

### 4.1 Functional

- A single dispatcher endpoint reads enabled regions from `pipeline_source_configs` (via `getRuntimeEnabledRegions()`) and triggers one `POST /api/cron/pipeline?region=<id>` per region.
- Concurrency is bounded by `PIPELINE_DISPATCH_CONCURRENCY` (default 4, max 20) so we don't wake N Lambda instances simultaneously.
- The dispatcher does **not** block on per-region completion; it returns once each downstream request has been issued. Each per-region invocation runs on its own Vercel function instance (own 300s budget, own advisory lock, own `PipelineRun` row).
- A single GHA cron entry triggers the dispatcher daily; the four region-specific entries are removed.

### 4.2 Non-functional

- Auth: same `CRON_SECRET` bearer as existing `/api/cron/*` endpoints.
- Observability: emits `pipeline_dispatched` PostHog event with `{regions_total, regions_dispatched, regions_failed, concurrency}`.
- No new database tables. Per-region runs already write `PipelineRun` rows; that remains the unit of observability.

### 4.3 Out of scope (deferred to a true queue)

- Per-region retry on transient failure (today: retried on next cron tick).
- Dead-lettering, attempts counters, exponential backoff.
- Async community-dedup as a separate job kind.
- Global token-bucket rate limiting (per-run budget from PRD-0028 is sufficient at current scale).

These are the items 2.4-2.7 from `IMPROVEMENT_ROADMAP.md` §Phase 2. They will reopen when we have either (a) ≥ 10 enabled regions or (b) evidence of transient-failure churn worth automating.

## 5. Risks & Mitigations

| Risk                                           | Mitigation                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Dispatcher exceeds 60s for many regions        | `keepalive: true` on outbound fetch; concurrency cap keeps fan-out fast (4 regions issued in parallel ≈ 1-2s). |
| Per-region run still inherits the 300s ceiling | Accepted; same ceiling as today, just no longer shared. Full removal requires a real queue.                    |
| Lost region runs if dispatcher fails           | Next cron tick retries the whole set. Documented; no per-tick SLO.                                             |

## 6. Acceptance

- 4 GHA YAML blocks removed; 1 `pipeline_dispatch` block added.
- New route `/api/cron/pipeline/dispatch` returns `{ok, dispatched, failed, concurrency}` and is unauthenticated requests get 401.
- Adding a 5th region in the admin console results in it being included in the next dispatcher run with no code change.
