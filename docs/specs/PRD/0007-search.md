# PRD-0007: Search + filters

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead

## 1. Problem

Users frequently search by event name, festival, community, or category. Mirror web `/[city]/search` (`src/modules/search`).

## 2. Users & JTBD

- "I'm looking for Diwali 2026 in Stuttgart" / "Tamil community Munich".

## 3. Success Metrics

- Search result tap rate ≥ 40 %.
- Zero-result rate < 15 %.
- Search → save / follow conversion ≥ 5 %.

## 4. Scope

- Search bar with debounced suggestions.
- Filters: city (sticky), category, date range (today / this week / this month / pick).
- Results grouped: Events, Communities, Resources.
- Recent searches (local) and trending searches (server).

## 5. Out of Scope

- Map / geo search.
- Voice search.

## 6. User Stories

- As a user I see suggestions while typing.
- As a user with no results I get suggested adjacent queries (festival → general culture).

## 7. Acceptance Criteria

```
Given the user types "diwa"
When 250 ms have passed since the last keystroke
Then the suggestions endpoint is called once and returns within 300 ms (P75)
```

## 8. UX

Empty state, zero-results state with suggested queries; offline disables search bar.

## 9. Risks & Open Questions

- Postgres FTS vs. Meilisearch — start with Postgres trigram + FTS, revisit at scale.
