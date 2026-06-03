# PRD-0050: Organizer & host analytics v1

- **Status:** Implemented
- **Owner:** Product
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0050, PRD/TDD-0046 (organizer loop), PRD/TDD-0042 (analytics)

## 1. Problem

The platform records `UserInteraction` (VIEW / CLICK_ACCESS / SAVE / SHARE) but never shows organizers
or hosts how their community or events perform. Organizers return for _numbers_; today there is no
reason for them to come back. This is the #1 missing organizer-retention hook.

## 2. Users & JTBD

- **Community organizer:** "Is my profile getting seen? Are people clicking my WhatsApp link? Which
  events resonate?"
- **Event host:** "How did my event do — views, saves?"

## 3. Success Metrics

- Organizer dashboard shows views, access-clicks, saves for the workspace community over a window.
- Repeat organizer visits (PostHog `organizer` distinct returns) trend up post-launch.

## 4. Scope

- A read-only analytics module that aggregates `UserInteraction` for a community + its events.
- Surface a compact stats panel on the organizer (community) dashboard and host dashboard.
- Windowed counts (last 30 days) + per-event mini-breakdown (top events by views/saves).

## 5. Out of Scope

- Charts/time-series visualizations (numbers + simple lists v1).
- Benchmarking against other communities.
- Funnel/cohort analytics (PostHog already covers product-wide analytics).

## 6. User Stories

- As an organizer I see how many people viewed my community and clicked my access channels in the last 30 days.
- As an organizer I see my top events by views and saves.
- As a host I see views/saves for my events.

## 7. Acceptance Criteria (Gherkin)

```
Given I own a community with interactions
When I open the organizer dashboard
Then I see 30-day totals for community views, access-clicks, and saves

Given my community has events with interactions
Then I see a short list of top events by views/saves

Given a community/host with no interactions
Then I see a friendly empty state, not an error
```

## 8. UX

A "Your reach (last 30 days)" panel on the organizer + host dashboards: 3 stat tiles
(Views / Access clicks / Saves) + a "Top events" mini-list. Empty state explains data accrues as people
engage.

## 9. Risks & Open Questions

- Interaction volume is low early — empty/low states must feel encouraging, not broken.
- Authorization must scope strictly to the viewer's community/events (reuse community-permissions).
