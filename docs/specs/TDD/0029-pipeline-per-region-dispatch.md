# TDD-0029: Pipeline per-region dispatch (Phase 2 minimal)

- **Status:** Approved
- **Owner:** Platform
- **Linked:** PRD-0029

## 1. Architecture

```
GitHub Actions cron (1 entry, daily)
  └─ POST /api/cron/pipeline/dispatch  (this PRD)
       └─ getRuntimeEnabledRegions()   → [berlin, bw, bavaria, hesse, …]
       └─ bounded fan-out (concurrency = PIPELINE_DISPATCH_CONCURRENCY)
            └─ POST /api/cron/pipeline?region=<id>   (existing shard route)
                  └─ tryAdvisoryLock(`pipeline:cron:region=<id>`)
                  └─ runPipeline('cron', { regionIds: [<id>] })
                  └─ writes PipelineRun row
```

The dispatcher is **stateless**: no new DB table, no job persistence. It is one HTTP fan-out. The downstream shard route is the existing `/api/cron/pipeline` endpoint untouched.

## 2. Endpoint contract

`POST /api/cron/pipeline/dispatch`

- **Auth:** `Authorization: Bearer ${CRON_SECRET}` (same as other cron routes).
- **Body:** none.
- **Response 200:** `{ ok: boolean, dispatched: string[], failed: DispatchOutcome[], concurrency: number }`.
- **Response 401:** missing/bad bearer.
- **Response 500:** `APP_URL` env unset and request lacks a Host header.
- **`maxDuration`:** 60s (fan-out only; downstream invocations are async).

`DispatchOutcome` = `{ regionId, ok, status, error? }`.

## 3. Implementation notes

- **Base URL resolution:** prefer `process.env.APP_URL`; fall back to `${x-forwarded-proto}://${x-forwarded-host || host}` for local dev. This is the same pattern used by other server-side self-invokers in the repo.
- **Bounded concurrency:** simple worker-pool over a shared `cursor` index; no third-party deps. Default 4, env-overridable, hard ceiling 20.
- **`keepalive: true`:** lets the outbound `fetch` complete on the platform side even if the dispatcher's response has already been returned (Vercel/Node 20 supports this on `undici`).
- **No retry on dispatch failure:** a failed dispatch shows up in `failed[]` and as `regions_failed > 0` in the `pipeline_dispatched` PostHog event. Next cron tick retries the whole set.

## 4. Observability

`pipeline_dispatched` event payload:

| Field                | Type     | Source               |
| -------------------- | -------- | -------------------- |
| `trigger`            | `'cron'` | always               |
| `regions_total`      | int      | `regions.length`     |
| `regions_dispatched` | int      | count where `ok`     |
| `regions_failed`     | int      | count where `!ok`    |
| `concurrency`        | int      | resolved fan-out cap |

Per-region runs continue to emit `pipeline_shard_completed` (existing) with the full PRD-0026/27/28 counter set.

## 5. Failure modes

| Failure                                       | Behaviour                                            | Recovery                                      |
| --------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Downstream region returns 409 (lock conflict) | Recorded as `ok: false`, `status: 409` in `failed[]` | Next tick; lock should have released by then. |
| Downstream region returns 500                 | Same; reported in PostHog                            | Next tick.                                    |
| `fetch` itself throws (DNS / TLS)             | `ok: false`, `status: null`, `error: <msg>`          | Next tick.                                    |
| Entire dispatcher times out                   | GHA cron job fails; alert fires                      | Next tick.                                    |

## 6. Out-of-scope (future)

When evidence demands it (≥ 10 active regions OR observable transient-failure churn), graduate to a real queue with `PipelineJob` table, worker route, attempts/backoff, and dead-letter table. The contract of `/api/cron/pipeline?region=<id>` does not change; only the dispatcher is replaced. See `docs/architecture-review/IMPROVEMENT_ROADMAP.md` §Phase 2.4–2.7.

## 7. Test plan

- Auth: missing bearer → 401.
- Missing `APP_URL` and no Host → 500.
- Zero enabled regions → 200 with `dispatched: []`.
- Stubbed `getRuntimeEnabledRegions()` returning 5 regions + stubbed `fetch` → 5 dispatch attempts, concurrency respected.
- One downstream failure → reported in `failed[]`, `ok: false`, other regions still dispatched.
