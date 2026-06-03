# TDD-0049: Retention loop activation — weekly digest + saved-event reminders

- **Status:** Implemented
- **Linked PRD:** PRD-0049
- **Owner:** Eng

## 1. Architecture overview

Add **producers** (the first ever) in `apps/web/src/modules/notifications/`:

- `producers/weeklyDigest.ts` → `enqueueWeeklyDigest()` iterates active cities, gathers upcoming events
  (next 7 days, capped N), finds opted-in users for `WEEKLY_DIGEST`, calls `enqueueNotification` with
  idempotencyKey `WEEKLY_DIGEST:${cityId}:${userId}:${isoWeek}`.
- `producers/savedEventReminders.ts` → `enqueueSavedEventReminders()` finds events starting within the
  reminder window (e.g. 24–48h) that have `UserInteraction(SAVE)` (or saved relation), enqueues
  `SAVED_EVENT_REMINDER` with key `SAVED_EVENT_REMINDER:${eventId}:${userId}`.

Triggered by cron route `apps/web/src/app/api/cron/retention/route.ts` (GET, secured by a cron secret
header) that runs both producers then `processNotificationOutbox`.

## 2. Data model changes

**None.** Uses existing `NotificationOutbox`, `NotificationPreference`, `QuietHours`, `City`, `Event`,
`UserInteraction`/saved relation.

## 3. API surface

| Method | Path                            | Auth                                 | Notes                         |
| ------ | ------------------------------- | ------------------------------------ | ----------------------------- |
| GET    | `/api/v1/../api/cron/retention` | cron secret header (`x-cron-secret`) | runs producers + outbox flush |

## 4. Mobile screens & navigation

None (delivery via existing push/inbox; deep links already defined).

## 5. Push / Email / Inbox triggers

- `WEEKLY_DIGEST` → inbox + (push/email per prefs).
- `SAVED_EVENT_REMINDER` → inbox + push.
  Both flow through `processNotificationOutbox`, which applies prefs + quiet hours + suppression.

## 6. Feature flags

`RETENTION_PRODUCERS_ENABLED` (default ON in dev, gated in prod until verified). When off, the cron route
returns early without enqueuing.

## 7. Observability

Producers log counts enqueued/skipped; outbox status (SENT/FAILED/SUPPRESSED) already tracked. PostHog
notification events (existing) fire on send.

## 8. Failure modes & fallbacks

- Idempotent enqueue (upsert by key) ⇒ safe cron retries.
- One city/user failure is caught and skipped; job continues.

## 9. Test plan

- Unit: weekly digest enqueues once per (user, week) and is idempotent on re-run; respects opt-out.
- Unit: saved-event reminder enqueues once per (user, event) within window; not for past/out-of-window.

## 10. Rollout plan

Enable flag in dev → verify outbox rows + suppression → schedule cron in prod.

## 11. Backout plan

Set `RETENTION_PRODUCERS_ENABLED=false` (or unschedule cron): no producers run; infra returns to dormant.
