# PRD-0010: Resources, Bookmarks, Report content

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead, Trust & Safety

## 1. Problem

Three smaller but essential parity surfaces from web:

1. **Resources** (consular services + practical expat guides) — mirrors web `/[city]/resources` and `/[city]/consular-services`.
2. **Bookmarks** — saved events + communities (`/me`).
3. **Report content** — `STALE_INFO`, `BROKEN_LINK`, `INCORRECT_DETAILS`, `OTHER`.

## 2. Users & JTBD

- New arrival: "How do I register my address / find an Indian doctor?"
- Active user: "Find what I saved last week."
- Vigilant user: "This community link is dead — flag it."

## 3. Success Metrics

- Resource detail tap-through ≥ 25 %.
- Bookmarks tab DAU ≥ 20 % of active users.
- Report submissions ≥ 1 / 1000 active users / week.

## 4. Scope

- Resources tab (in Discover) grouped by `ResourceType`.
- Bookmarks tab with two segments (Events, Communities).
- Report sheet from event/community detail; minimal fields; rate-limited.

## 5. Out of Scope

- Resource ratings.
- Bookmark folders/tags.

## 6. User Stories

- As a user I tap "City Registration" and reach the official Bürgeramt link.
- As a user I see all my saved events with date + Add to Calendar.
- As a user I report a broken link in three taps.

## 7. Acceptance Criteria

```
Given a user opens Bookmarks offline
When they tap an event
Then the cached detail renders, with Save state intact
```

## 8. UX

Resource cards minimal — title, type badge, short description, external-link icon.

## 9. Risks & Open Questions

- Report abuse → rate-limit per user/IP; require auth for reports.
