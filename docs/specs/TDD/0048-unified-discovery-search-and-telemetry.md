# TDD-0048: Unified discovery search + query telemetry

- **Status:** Implemented
- **Linked PRD:** PRD-0048
- **Owner:** Eng

## 1. Architecture overview

`modules/search/queries.ts` gains:

- `searchResources(query, citySlug?, limit)` — FTS over `resources(title + description)`, scope-aware via
  the existing resolver semantics (city slug ⇒ resolve that city's applicable resources; no city ⇒ national).
- `searchCommunities` / `searchEvents` accept an **optional** `citySlug` (empty ⇒ national, no
  `resolveCityIds` gate).
- `searchAll` returns a unified `SearchResultRow` discriminated union extended with `RESOURCE`, accepts
  optional `citySlug`, and applies **blended ranking**.

Telemetry: a small server helper `recordSearchInteraction()` (in `modules/search`) writes a
`UserInteraction(SEARCH)` row with metadata; called from the search pages and the `/api/v1/search` route.

## 2. Data model changes

**None.** Reuses `UserInteraction` (`interactionType = SEARCH`, `entityType` set to a sentinel
`COMMUNITY` with `metadata.kind = 'search'`, `entityId = ''`-safe → use a constant `search` id) — to avoid
a schema change we store the query payload in `metadata`. (Ranking reads existing
`trustScore`/`activityScore`/`isEssential`/`createdAt`/`startsAt` columns.)

> Note: `UserInteraction.entityId` is required (String). For search rows we set `entityId` to the
> lowercased query (truncated) so the existing `(entityType, entityId)` index stays meaningful, and put
> the structured payload in `metadata`.

## 3. API surface

| Method | Path             | Auth   | Request                                | Response                                    |
| ------ | ---------------- | ------ | -------------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/search` | public | `q`, optional `city`, `type`, `cursor` | `{ items: SearchResultRow[], nextCursor? }` |

`SearchResultRow` (shared shape, discriminated by `type`): `COMMUNITY | EVENT | RESOURCE`.

## 4. Mobile screens & navigation

No mobile change in this TDD. Shared result types remain additive (new `RESOURCE` variant) so mobile can
adopt later without breaking.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

`SEARCH_UNIFIED` (default ON in dev). National route + home box are additive; city search keeps working
if flag is off (resources simply not appended). Kill switch: stop appending resource results + hide the
national box.

## 7. Observability

- `search_performed` PostHog event gains `scope` and `entity_filter` props.
- `UserInteraction(SEARCH)` rows enable a SQL zero-result-rate query:
  `count(*) filter (where metadata->>'hasResults' = 'false') / count(*)`.

## 8. Failure modes & fallbacks

- FTS error ⇒ ILIKE fallback (already present); resource FTS mirrors that pattern.
- Telemetry write is fire-and-forget (never blocks render), mirroring `recordInteraction`.

## 9. Test plan

- Unit/integration (vitest): `searchResources` returns scoped + national results; `searchAll` includes
  resources and applies blended ordering; city-optional behavior; telemetry row shape.

## 10. Rollout plan

Flag ON in dev → ship. Additive; no migration.

## 11. Backout plan

Flip `SEARCH_UNIFIED` off: national box hidden, resources not appended, city search unchanged.
