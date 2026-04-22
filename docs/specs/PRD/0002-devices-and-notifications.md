# PRD-0002: Device registry, NotificationPreference, Outbox

- **Status:** Draft
- **Owner:** Backend lead
- **Reviewers:** PM, Eng Lead, Mobile lead

## 1. Problem

We need a reliable substrate to deliver push, email, and in-app inbox messages — gated by user preferences and frequency caps — without spamming or duplicating sends.

## 2. Users & JTBD

- End user — "I only want notifications I care about, in the channels I chose, at sane times."
- Backend dev — "I want to enqueue a notification from any module without knowing about transport."

## 3. Success Metrics

- Push opt-in ≥ 60 % (PRD-0004 measures the prompt).
- Notification-related uninstalls < 1 % week-over-week.
- Outbox dispatch P95 < 30 s from enqueue.
- Duplicate-send rate < 0.1 % (idempotency).

## 4. Scope

- `Device` table for Expo push tokens.
- `NotificationPreference` table for per-user × per-topic × per-channel toggles + quiet hours.
- `NotificationOutbox` table + worker (BullMQ on Redis, or pg-boss on the existing Postgres).
- API: register/refresh/unregister device; read/update preferences.
- Producer hooks in `modules/event`, `modules/community`, `modules/pipeline` to enqueue.
- Channel adapters: Expo Push, Email (Resend), In-App Inbox (DB row).

## 5. Out of Scope

- WhatsApp Business API (Phase 2).
- Templating UI for marketers (Phase 2).

## 6. User Stories

- As a user I can turn off "Weekly digest" while keeping "Saved event reminders" on.
- As a user my quiet hours suppress all non-critical pushes.
- As a backend dev I can call `notify({ userId, topic, payload })` and trust delivery + dedup.

## 7. Acceptance Criteria

```
Given a user with `topic=weekly_digest, channel=push` set to false
When the Friday digest job runs
Then no push is sent to that user, but email is still sent if `channel=email` is true

Given an outbox row with idempotencyKey="evt:123:reminder:T-24h"
When the worker is retried after a crash
Then the message is delivered exactly once
```

## 8. UX

Preferences UI lives in PRD-0004.

## 9. Risks & Open Questions

- Redis cost vs. pg-boss simplicity → start with pg-boss.
- Token rotation on iOS reinstalls → handled by `device.register` upsert keyed on `(platform, installationId)`.
