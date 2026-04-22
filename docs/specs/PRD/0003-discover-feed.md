# PRD-0003: Mobile Discover feed

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Eng Lead, Mobile lead, Design

## 1. Problem

The home of the mobile app must answer "what's happening for me, near me, soon?" within seconds — mirroring web's `/[city]` discovery (`src/app/[city]/page.tsx` and `src/modules/discovery`).

## 2. Users & JTBD

- Diaspora user in Stuttgart (or any active city) — "Show me events this week and the active communities I should know about."

## 3. Success Metrics

- Time-to-first-card (P75) < 1.5 s on Wi-Fi, < 2.5 s on 3G.
- Card → detail CTR ≥ 25 %.
- Pull-to-refresh usage ≥ 30 % of sessions.

## 4. Scope

- City picker (current city defaulted from device locale + last selection).
- Tabs: **This week**, **Communities**, **Resources** (mirrors web tabs).
- Event cards: image, title, date/time, venue, community, save button.
- Community cards: logo, name, category, activity score badge, save.
- "Trending" rail using `Community.isTrending` + `modules/scoring`.
- Empty + offline + error states; cached last feed served offline.
- Pull-to-refresh, infinite scroll.

## 5. Out of Scope

- Personalized "For you" rail (Phase 3, needs scoring).
- Map view.

## 6. User Stories

- As a user opening the app I see today's & this week's events for my city.
- As a user I can switch cities from a sheet.
- As a user with no network I still see the last feed.

## 7. Acceptance Criteria

```
Given the app cold-starts with a cached city
When the Discover screen mounts
Then cached feed renders within 200 ms and a background refresh updates it

Given the user pulls to refresh on a slow network
When the request fails
Then the existing cards remain and a non-blocking toast shows "Couldn't update"
```

## 8. UX

Figma: <link>. States: loading skeleton, empty (city has no events), error, offline. A11y labels per card.

## 9. Risks & Open Questions

- Feed payload size on slow networks → cap to 20 cards/page, AVIF/WebP images via CDN.
