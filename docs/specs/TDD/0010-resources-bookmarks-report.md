# TDD-0010: Resources, Bookmarks, Report

- **Status:** Draft
- **Linked PRD:** PRD-0010

## 1. Architecture overview

Three thin surfaces reusing existing web modules.

## 2. Data model changes

None.

## 3. API surface

| Method | Path                                  | Auth     | Request              | Response          |
| ------ | ------------------------------------- | -------- | -------------------- | ----------------- |
| GET    | `/api/v1/cities/:slug/resources?type` | optional | —                    | `Resource[]`      |
| GET    | `/api/v1/me/saves/events?cursor`      | access   | —                    | `EventsPage`      |
| GET    | `/api/v1/me/saves/communities?cursor` | access   | —                    | `CommunitiesPage` |
| POST   | `/api/v1/reports`                     | access   | `ContentReportInput` | `ContentReport`   |

## 4. Mobile screens & navigation

```
(tabs)/discover/resources.tsx
(tabs)/bookmarks/index.tsx
components/ReportSheet.tsx     # invoked from event + community detail
```

## 5. Push / Email / Inbox triggers

- Report submitted → admin email; no user-facing notif.

## 6. Feature flags

- `report.enabled`

## 7. Observability

- `resources.viewed{type}`, `bookmarks.opened{tab}`, `report.submitted{type}`.
- Rate-limit hit counter `report.rate_limited`.

## 8. Failure modes & fallbacks

- Bookmarks endpoint slow → render local cache.

## 9. Test plan

- Contract for all three; E2E for happy paths.

## 10. Rollout plan

GA.

## 11. Backout plan

Hide Report sheet via flag.
