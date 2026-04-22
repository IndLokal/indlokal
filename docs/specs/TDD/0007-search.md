# TDD-0007: Search

- **Status:** Draft
- **Linked PRD:** PRD-0007

## 1. Architecture overview

- Reuses `src/modules/search`. New REST surface `/api/v1/search/*`.
- Mobile screen `app/(tabs)/search/index.tsx`.

## 2. Data model changes

- Add Postgres trigram index on `events.title`, `communities.name` if not present.

## 3. API surface

| Method | Path                                                     | Auth     | Request       | Response       |
| ------ | -------------------------------------------------------- | -------- | ------------- | -------------- |
| GET    | `/api/v1/search/suggest?q&citySlug`                      | optional | —             | `Suggestion[]` |
| GET    | `/api/v1/search?q&citySlug&category&from&to&type&cursor` | optional | `SearchQuery` | `SearchPage`   |
| GET    | `/api/v1/search/trending?citySlug`                       | optional | —             | `string[]`     |

## 4. Mobile screens & navigation

- Recent searches in MMKV; cap 10.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

- `search.suggest.enabled`

## 7. Observability

- `search.query{citySlug, hasResults}`, `search.result.tapped{rank,type}`, `search.zero_result_query`.

## 8. Failure modes & fallbacks

- Backend slow → cancel in-flight on new keystroke; show last results.

## 9. Test plan

- Unit: query parser, debounce.
- Contract.
- E2E: typo tolerance, filter flow.

## 10. Rollout plan

GA.

## 11. Backout plan

Disable suggest flag (search itself is core).
