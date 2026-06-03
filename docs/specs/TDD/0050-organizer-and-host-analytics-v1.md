# TDD-0050: Organizer & host analytics v1

- **Status:** Implemented
- **Linked PRD:** PRD-0050
- **Owner:** Eng

## 1. Architecture overview

New read-only module `apps/web/src/modules/analytics-readout/` (web-only) with pure aggregation queries
over `UserInteraction`:

- `getCommunityReach(communityId, sinceDays=30)` → `{ views, accessClicks, saves, topEvents[] }`.
- `getHostReach(userId, sinceDays=30)` → `{ views, saves, topEvents[] }` over events `createdByUserId=userId`.

Surfaced via a server component panel reused on both dashboards. Authorization handled by the caller
(organizer/host pages already gate access); the functions take ids the caller is authorized for.

## 2. Data model changes

**None.** Reads `UserInteraction(entityType, entityId, interactionType, createdAt)` and `Event` for titles.
Relies on existing index `@@index([entityType, entityId])`.

## 3. API surface

No public endpoint (server components call the module directly). Optional future `/api/v1/organizer/reach`.

## 4. Mobile screens & navigation

None v1.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None — additive read-only panel; degrades to empty state with zero data.

## 7. Observability

No new analytics event required; panel render can reuse existing page-view tracking.

## 8. Failure modes & fallbacks

Aggregation failure ⇒ panel renders empty state (wrapped in try/catch; never throws into the page).

## 9. Test plan

- Unit/integration: `getCommunityReach` counts VIEW/CLICK_ACCESS/SAVE correctly within the window and
  computes top events; returns zeros for a community with no interactions.

## 10. Rollout plan

Ship additively to organizer + host dashboards.

## 11. Backout plan

Remove the panel import; module is side-effect free.
