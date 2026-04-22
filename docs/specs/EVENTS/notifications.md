# Notification Catalog

Single source of truth for every notification IndLokal sends. Each row is one **topic**; each topic has one or more **channels**. The outbox worker reads these rules.

## Defaults

- Quiet hours: 22:00–08:00 user local TZ (PUSH only).
- Frequency caps below are per user.
- Critical alerts (none today) bypass quiet hours.

## Matrix

| Topic                  | Trigger                                                                   | Channels (default on)                                              | Cap                               | Score gate  | Copy ID                   |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- | ----------- | ------------------------- |
| `CITY_NEW_EVENT`       | `Event.published` in followed city/category                               | PUSH (instant if `notificationScore ≥ 0.7`), INBOX, EMAIL (digest) | 1 instant push/day; 1 digest/week | yes         | `city_new_event.v1`       |
| `COMMUNITY_UPDATE`     | New event from followed community OR community profile materially updated | PUSH, INBOX                                                        | 3/day/community                   | yes         | `community_update.v1`     |
| `SAVED_EVENT_REMINDER` | T-24h, T-2h before `Event.startsAt`                                       | PUSH, INBOX                                                        | per-event                         | no          | `saved_event_reminder.v1` |
| `FESTIVAL`             | Cron: 7 days before each tagged festival; scoped to user city             | PUSH, EMAIL                                                        | 1 per festival                    | no          | `festival.v1`             |
| `WEEKLY_DIGEST`        | Friday 10:00 user local                                                   | PUSH, EMAIL                                                        | 1/week                            | yes (top-N) | `weekly_digest.v1`        |
| `ORGANIZER_RSVP`       | New save/RSVP on organizer's event                                        | PUSH, INBOX                                                        | 5/day/organizer                   | no          | `organizer_rsvp.v1`       |
| `ORGANIZER_SUBMISSION` | `PipelineItem` state change                                               | PUSH, EMAIL, INBOX                                                 | per-state                         | no          | `organizer_submission.v1` |
| `REENGAGEMENT`         | D3 / D7 / D30 inactive                                                    | PUSH, EMAIL                                                        | one per ladder step               | yes         | `reengagement.v1`         |

## Copy bank (en) — short examples

- `city_new_event.v1`: `New in {city}: {title}` / `{shortDate} · {venue}`
- `community_update.v1`: `{community} just posted: {title}`
- `saved_event_reminder.v1.t24`: `Tomorrow: {title}` / `{time} · {venue}`
- `saved_event_reminder.v1.t2`: `In 2 hours: {title}` / `{venue}`
- `festival.v1`: `{festival} in {city} — see what's planned`
- `weekly_digest.v1`: `This weekend in {city}` / `{n} events for you`
- `organizer_rsvp.v1`: `{n} new saves on {title}`
- `organizer_submission.v1.approved`: `Your submission "{title}" is live`
- `reengagement.v1.d7`: `New events in {city} this week`

Localize variants in `packages/shared/src/notifications/copy/{lang}.ts`.

## Suppression rules

A push is **suppressed** (logged with reason) when ANY of:

- User pref for `(topic, PUSH)` is false.
- Quiet hours active in user TZ (delay until end of quiet window unless cap rolls).
- Frequency cap exceeded.
- `notificationScore < threshold` and the topic gates on score.
- Device has no valid `expoPushToken`.

## Idempotency keys

| Topic                  | Key pattern                                    |
| ---------------------- | ---------------------------------------------- | ------ |
| `CITY_NEW_EVENT`       | `user:{uid}:city_event:{eventId}`              |
| `COMMUNITY_UPDATE`     | `user:{uid}:community:{cid}:update:{updateId}` |
| `SAVED_EVENT_REMINDER` | `user:{uid}:event:{eventId}:reminder:{T-24h    | T-2h}` |
| `FESTIVAL`             | `user:{uid}:festival:{slug}:{year}`            |
| `WEEKLY_DIGEST`        | `user:{uid}:digest:{ISOWeek}`                  |
| `ORGANIZER_RSVP`       | `user:{uid}:event:{eventId}:rsvps:{date}`      |
| `ORGANIZER_SUBMISSION` | `submission:{pipelineItemId}:{state}`          |
| `REENGAGEMENT`         | `user:{uid}:reengagement:{step}`               |

## Email digest

Personalized "This weekend in {city}" Friday 10:00 user TZ. Composed from top-N `notificationScore` events for cities the user follows. Footer: one-tap unsubscribe per topic + global.

## Compliance

- DPDP / GDPR consent recorded at signup; per-channel toggle.
- Every email includes one-click unsubscribe header (RFC 8058) + visible link.
- Push payloads contain no PII beyond user-visible content + `deepLink`.
