# TDD-0043: Business Intent P0 Instrumentation

- **Status:** Implemented
- **Linked PRD:** PRD-0043
- **Owner:** Product Engineering

## 1. Architecture overview

This is a measurement slice over the existing Business and Careers lens from
PRD-0020. It follows the central analytics strategy in PRD/TDD-0042.

Components touched:

- Web business/event list pages preserve business-lens context into event detail.
- Web event detail passes lens context to view/save/registration tracking.
- Mobile Discover fires the canonical business lens event and forwards lens
  context into event detail.
- Mobile event detail includes lens metadata on event actions.
- Existing tracking endpoints store metadata into `user_interactions`.
- Admin `/admin/analytics` reads `user_interactions` for a rolling 30-day city
  summary. Business intent is the first section in the general analytics
  workspace.

No new service boundary, migration, or public business entity is introduced.

## 2. Data model changes

No Prisma migration.

Reuse:

- `UserInteraction.entityType`
- `UserInteraction.entityId`
- `UserInteraction.interactionType`
- `UserInteraction.cityId`
- `UserInteraction.metadata`

Conventions:

- Lens views are stored as:
  - `entityType = RESOURCE`
  - `entityId = business_lens`
  - `interactionType = VIEW`
  - `metadata.lens_context = business_careers`
  - `metadata.result_count = number`
- Business-lens event actions are event interactions with:
  - `metadata.lens_context = business_careers`

## 3. API surface

No new public endpoint.

Existing endpoints extended additively:

| Method | Path            | Auth     | Request change                        | Response |
| ------ | --------------- | -------- | ------------------------------------- | -------- |
| POST   | `/api/track`    | Optional | Accept optional `metadata` for views  | `{ ok }` |
| POST   | `/api/v1/track` | Optional | Accept canonical business/event names | `{ ok }` |

`/api/v1/track` maps:

- `business_lens_viewed` → `VIEW`
- `event_register_clicked` → `CLICK_ACCESS`

## 4. Mobile screens & navigation

Updated:

- `apps/mobile/app/(tabs)/index.tsx`
  - Fires `business_lens_viewed` when the Events tab uses the Business and
    Careers lens.
  - Adds `lens=business` to event detail links opened from the business lens.
  - Uses lens-specific persistent cache keys.
- `apps/mobile/app/events/[slug].tsx`
  - Reads `lens` from route params.
  - Adds `metadata.lens_context = business_careers` to event detail view, save,
    unsave, share, calendar, and registration tracking when applicable.

## 5. Push / Email / Inbox triggers

None.

This feature does not enqueue notifications or change reminder behavior.

## 6. Feature flags

No feature flag.

Rationale: the Business and Careers lens already exists. This change only adds
measurement metadata and an admin analytics section. Backout is a code revert.

## 7. Observability

Local source of truth:

- `user_interactions` with `metadata.lens_context = business_careers`.

PostHog:

- `business_lens_viewed`
- `event_viewed`
- `event_saved`
- `event_unsaved`
- `event_register_clicked`

Admin readout:

- `/admin/analytics`
- Section: Business intent
- Rolling 30 days.
- Metrics: lens views, empty rate, detail rate, saves, registration clicks.

## 8. Failure modes & fallbacks

| Failure                             | Fallback                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| Client-side tracking request fails  | User action continues; telemetry is best-effort                    |
| PostHog unavailable                 | Local `user_interactions` still records API-backed interactions    |
| Missing city on an interaction      | Interaction is ignored by city-level admin aggregation             |
| Event reached without `lens` param  | Existing all-events tracking behavior remains unchanged            |
| Empty result count absent/undefined | Admin empty-rate treats it as not-empty rather than failing render |

## 9. Test plan

- Typecheck:
  - `pnpm -F web typecheck`
  - `pnpm -F mobile typecheck`
- Lint:
  - `pnpm -F web lint`
- Mobile unit tests:
  - `pnpm -F mobile test`

Manual QA:

- Open `/{city}/business-events`; verify a `business_lens_viewed` interaction is
  recorded with `entityId = business_lens`.
- Open an event from that page; verify URL includes `?lens=business`.
- Save the event; verify the save interaction contains
  `metadata.lens_context = business_careers`.
- Click registration; verify an EVENT `CLICK_ACCESS` interaction is recorded.
- Open `/admin/analytics`; verify the city row updates.

## 10. Rollout plan

1. Ship with the existing Business and Careers lens.
2. Review `/admin/analytics` after one week for smoke signals.
3. Review after 30 days against PRD-0020's decision criteria.

No staged rollout is required because this is additive telemetry and admin-only
reporting.

## 11. Backout plan

- Remove the Business intent section from `/admin/analytics`.
- Remove `?lens=business` forwarding from web/mobile event links.
- Keep the additive tracking endpoint handling if already deployed, since it is
  backward-compatible.
