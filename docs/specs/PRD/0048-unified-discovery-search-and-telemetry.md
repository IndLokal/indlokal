# PRD-0048: Unified, need-first discovery search + query telemetry

- **Status:** Implemented
- **Owner:** Product
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0048, ADR-0010, PRD/TDD-0007 (search v1), PRD/TDD-0051 (taxonomy)

## 1. Problem

Search is city-scoped and indexes only communities + events. Users think _need → location_; the product
forces _location → vertical_. Resources (the best evergreen/SEO asset) are not searchable at all, and we
have **no measurement** of search quality (no zero-result tracking), so we cannot improve it.

## 2. Users & JTBD

- **Newcomer / mover:** "I'm moving to Germany — find Indian life near me" (may not know the city yet).
- **Resident:** "Find a Diwali event / a Telugu group / how to register my address" — wants one box.
- **Operators:** need to see what people search and what returns nothing.

## 3. Success Metrics

- `search_performed` continues to fire with `has_results`, `results_count`, plus new `scope`
  (`city` | `national`) and `entity_filter`.
- New: **zero-result rate** queryable from `UserInteraction(SEARCH)` metadata.
- Leading indicator: share of searches run from the home/global bar (national scope) > 0 after launch.

## 4. Scope

- Add **Resource** results to `searchAll` alongside Community + Event.
- Make `citySlug` **optional** in the search layer; absent ⇒ national.
- Single result row shape with an `entityKind` discriminator (`COMMUNITY | EVENT | RESOURCE`).
- **Blended ranking**: text relevance boosted by trust/essential/recency.
- A **global search box** on the home page + a national results route `/search`.
- **Query telemetry**: persist every executed search (`UserInteraction.SEARCH`) with
  `{ query, scope, resultsCount, hasResults, entityFilter }`.

## 5. Out of Scope

- Semantic/vector search, AI concierge (ADR-0010 deferred).
- Geo/distance ranking (12-mo item).
- Mobile app search changes (web first; shared types stay compatible).
- Organization-specific search UI (organizationType lands in PRD-0051; surfaced as a facet later).

## 6. User Stories

- As a visitor on the home page, I can search all of Germany from one box and see communities, events,
  and resources together.
- As a city user, search defaults to my city but I can switch to "All Germany".
- As an operator, I can measure how many searches return zero results.

## 7. Acceptance Criteria (Gherkin)

```
Given I am on the home page
When I search "telugu"
Then I land on /search?q=telugu with national-scope results spanning communities, events, and resources

Given I am on /stuttgart/search
When I search "anmeldung"
Then resources appear in the results (not only communities/events)

Given any executed search with q length >= 2
When the page renders
Then one UserInteraction(SEARCH) row is written with scope, resultsCount and hasResults

Given a query that matches nothing
Then results_count = 0, has_results = false, and the interaction row records the zero result
```

## 8. UX

- Home: prominent single search input (national). Persistent top-bar search on city pages (defaults to
  current city, with an "All Germany" toggle).
- National results route `/search?q=` mirrors the city results layout, grouped by entity kind.
- Empty/zero-result state offers "browse communities" + "browse resources" fallbacks.

## 9. Risks & Open Questions

- National FTS over all cities must stay fast — cap result counts, rely on existing GIN/`ts_rank`.
- Ranking weights are heuristic; expose them as named constants for tuning.
