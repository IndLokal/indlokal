# TDD-0005: Event detail

- **Status:** Draft
- **Linked PRD:** PRD-0005
- **Depends on:** TDD-0001, TDD-0002, TDD-0003

## 1. Architecture overview

- Mobile screen `app/(tabs)/discover/events/[slug].tsx`.
- Server: reuses `src/modules/event/queries.ts`. Save reuses `src/app/actions/saves.ts` logic, lifted into `modules/event/saves.ts` and exposed via `/api/v1/events/:slug/save`.

## 2. Data model changes

None.

## 3. API surface

| Method | Path                        | Auth     | Request      | Response      |
| ------ | --------------------------- | -------- | ------------ | ------------- |
| GET    | `/api/v1/events/:slug`      | optional | —            | `EventDetail` |
| POST   | `/api/v1/events/:slug/save` | access   | —            | `SaveState`   |
| DELETE | `/api/v1/events/:slug/save` | access   | —            | `SaveState`   |
| POST   | `/api/v1/track`             | optional | `TrackEvent` | `Ack`         |

`EventDetail` includes community summary, categories, trustSignals, related events.

## 4. Mobile screens & navigation

- Share: native share sheet with branded URL `https://indlokal.com/:citySlug/events/:slug` and OG image (server-rendered today).
- Calendar: `expo-calendar` to add event with reminders.

## 5. Push / Email / Inbox triggers

- On save: enqueue `SAVED_EVENT_REMINDER` outbox rows for T-24h and T-2h with idempotency `evt:{id}:reminder:{offset}`.

## 6. Feature flags

- `events.related.enabled`

## 7. Observability

- `event.detail.viewed`, `event.saved`, `event.calendar_added`, `event.shared`, `event.register_clicked`.

## 8. Failure modes & fallbacks

- Calendar permission denied → fall back to local notification only.
- Registration link broken → trust signal `BROKEN_LINK` capture path via Report.

## 9. Test plan

- Unit: TZ formatting, save reducer.
- Contract: event endpoints.
- E2E: save → reminders enqueued (assert via API).

## 10. Rollout plan

- GA with v1.0.

## 11. Backout plan

- Disable `events.related.enabled` if data is noisy.
