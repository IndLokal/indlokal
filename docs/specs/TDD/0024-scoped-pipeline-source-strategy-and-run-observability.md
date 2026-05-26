# TDD-0024: Scoped pipeline source strategy and run observability

- **Status:** Draft
- **Linked PRD:** PRD-0024
- **Owner:** Founders

## 1. Architecture overview

1. CLI/cron pass optional scope (`citySlugs`, `regionIds`) into orchestrator.
2. Orchestrator filters enabled regions by scope.
3. Pinned strategies are filtered by scope hints:
   - `CITY` -> `hintCitySlug`
   - `REGION` -> `hintState`
   - `GENERIC` excluded for scoped runs
4. Run history persists requested scope arrays.

## 2. Data model changes

`PipelineRun` additive fields:

- `scopeRegionIds String[] @default([])`
- `scopeCitySlugs String[] @default([])`

Migration required and idempotent via Prisma migrate deploy.

## 3. API surface

No new endpoint.

Existing:

| Method | Path               | Auth               | Request                                               | Response                |
| ------ | ------------------ | ------------------ | ----------------------------------------------------- | ----------------------- |
| POST   | /api/cron/pipeline | Bearer CRON_SECRET | Optional repeated/comma `city`, `region` query params | `{ ok, scope, result }` |

## 4. Mobile screens & navigation

No changes.

## 5. Push / Email / Inbox triggers

No changes.

## 6. Feature flags

None.

## 7. Observability

- Persist `scopeRegionIds` and `scopeCitySlugs` on each run record.
- Existing stage timing and error arrays remain unchanged.

## 8. Failure modes & fallbacks

| Failure                            | Fallback                              |
| ---------------------------------- | ------------------------------------- |
| Scope filters to zero regions      | fail fast with explicit error message |
| Invalid strategy scope in defaults | reject during defaults parse/sync     |

## 9. Test plan

- Unit:
  - region scope filter behavior
  - pinned strategy scope filtering behavior
- Integration:
  - cron query parsing for repeated + comma forms
  - run history write includes scope arrays
- Regression:
  - unscoped runs still include generic pinned strategies

## 10. Rollout plan

1. Apply migration.
2. Deploy orchestrator/runtime changes.
3. Validate one scoped run per configured region.

## 11. Backout plan

1. Temporarily call unscoped pipeline route from cron.
2. Revert scope write path in orchestrator if needed (columns are additive and can remain).
