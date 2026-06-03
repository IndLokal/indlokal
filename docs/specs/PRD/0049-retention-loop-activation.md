# PRD-0049: Retention loop activation — weekly digest + saved-event reminders

- **Status:** Implemented
- **Owner:** Product
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0049, PRD/TDD-0015 (notification outbox), PRD/TDD-0042 (analytics)

## 1. Problem

The full retention machinery exists — `NotificationOutbox`, `NotificationPreference`, `QuietHours`,
`InboxItem`, `Device`, topics `WEEKLY_DIGEST` / `SAVED_EVENT_REMINDER` / `CITY_NEW_EVENT` — but has
**zero producers**. Nothing ever enqueues a notification, so users have no reason to return. This is
activation of built infrastructure, not new infrastructure.

## 2. Users & JTBD

- **Resident:** "Tell me what's happening in my city this week."
- **Saver:** "Remind me before the event I saved."

## 3. Success Metrics

- Outbox rows produced weekly per active city; SENT/SUPPRESSED ratios observable.
- Reminder open/return rate (PostHog) > 0; D7/D30 return uplift over time.

## 4. Scope

- **Weekly per-city digest producer:** for each active city, enqueue a `WEEKLY_DIGEST` notification per
  opted-in user summarizing upcoming events.
- **Saved-event reminder producer:** for events starting within a reminder window that a user saved,
  enqueue a `SAVED_EVENT_REMINDER` once (idempotent).
- Both run via a cron-triggered route; both respect `NotificationPreference` + `QuietHours` (already
  enforced by the outbox consumer).

## 5. Out of Scope

- New transports/channels (reuse existing transports).
- Re-engagement / win-back campaigns (`REENGAGEMENT` topic stays dormant for now).
- Digest content personalization beyond city + upcoming events.

## 6. User Stories

- As an opted-in user I receive one weekly digest of my city's upcoming events.
- As a user who saved an event I get one reminder before it starts.
- As a user with quiet hours / opted out, I receive nothing (suppressed).

## 7. Acceptance Criteria (Gherkin)

```
Given active cities with upcoming events and opted-in users
When the weekly digest job runs
Then exactly one WEEKLY_DIGEST outbox row is enqueued per (user, week) idempotently

Given a user saved an event starting within the reminder window
When the reminder job runs
Then exactly one SAVED_EVENT_REMINDER is enqueued for that (user, event)

Given a user has opted out or is in quiet hours
Then their notification is suppressed by the existing consumer, not enqueued twice
```

## 8. UX

No new UI; uses existing inbox + push/email transports. Digest links to the city events page; reminder
links to the event.

## 9. Risks & Open Questions

- Must be strictly idempotent (cron may retry) — rely on `idempotencyKey` upsert.
- Volume control: cap digest to top N upcoming events per city.
