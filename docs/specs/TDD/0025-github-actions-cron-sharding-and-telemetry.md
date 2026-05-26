# TDD-0025: GitHub Actions cron sharding and telemetry

- **Status:** Draft
- **Linked PRD:** PRD-0025
- **Owner:** Founders

## 1. Architecture overview

1. GitHub Actions workflow defines independent region shard jobs and optional dispatch inputs.
2. Jobs call `/api/cron/pipeline` with `region` query scope.
3. Cron route authenticates bearer token using `CRON_SECRET`.
4. Route triggers pipeline and emits shard-level telemetry event.

## 2. Data model changes

No schema changes required for this item.

## 3. API surface

No new endpoint.

Existing endpoint behavior:

| Method | Path               | Auth               | Request                                               | Response                |
| ------ | ------------------ | ------------------ | ----------------------------------------------------- | ----------------------- |
| POST   | /api/cron/pipeline | Bearer CRON_SECRET | Optional repeated/comma `city`, `region` query params | `{ ok, scope, result }` |

Telemetry event from route:

- `pipeline_shard_completed`
- properties: `region_ids`, `city_slugs`, `items_fetched`, `items_queued`, `errors_count`, `duration_ms`

## 4. Mobile screens & navigation

No changes.

## 5. Push / Email / Inbox triggers

No changes.

## 6. Feature flags

None.

## 7. Observability

- Server analytics event on every cron shard response.
- Existing logs remain fallback for incident debugging.

## 8. Failure modes & fallbacks

| Failure                     | Fallback                                         |
| --------------------------- | ------------------------------------------------ |
| Missing/invalid CRON_SECRET | return unauthorized without running pipeline     |
| One shard fails             | other shard jobs continue per workflow isolation |
| Analytics failure           | telemetry no-op, response unaffected             |

## 9. Test plan

- Unit:
  - cron route scope parsing and auth guard behavior
- Integration:
  - workflow endpoints hit route with expected region query
  - telemetry event payload includes expected fields
- Regression:
  - manual dispatch mode still works for all/all-shard selection

## 10. Rollout plan

1. Merge workflow updates.
2. Verify dispatch path in production environment.
3. Observe one full cron cycle and telemetry volume.

## 11. Backout plan

1. Reduce workflow to single unscoped job.
2. Keep route behavior unchanged while scheduler is simplified.
