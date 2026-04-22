# TDD-0003: Mobile Discover feed

- **Status:** Draft
- **Linked PRD:** PRD-0003

## 1. Architecture overview

- Mobile screens under `apps/mobile/app/(tabs)/discover/...`.
- Data via TanStack Query against `/api/v1/discovery/*`.
- Server reuses `src/modules/discovery/queries.ts`; thin handlers under `apps/web/src/app/api/v1/discovery/`.
- Offline cache via `@tanstack/query-async-storage-persister` keyed by `(citySlug, tab)`.

## 2. Data model changes

None.

## 3. API surface

| Method | Path                                                      | Auth     | Request            | Response           |
| ------ | --------------------------------------------------------- | -------- | ------------------ | ------------------ |
| GET    | `/api/v1/cities`                                          | optional | —                  | `City[]`           |
| GET    | `/api/v1/cities/:slug`                                    | optional | —                  | `CityDetail`       |
| GET    | `/api/v1/discovery/:citySlug/events?from&to&cursor&limit` | optional | `EventsQuery`      | `EventsPage`       |
| GET    | `/api/v1/discovery/:citySlug/communities?cursor&limit`    | optional | `CommunitiesQuery` | `CommunitiesPage`  |
| GET    | `/api/v1/discovery/:citySlug/trending`                    | optional | —                  | `TrendingResponse` |

`EventsPage = { items: EventCard[], nextCursor?: string }` etc. All Zod-defined in `packages/shared/src/contracts/discovery.ts`.

## 4. Mobile screens & navigation

```
(tabs)/
  discover/
    index.tsx           # Discover home with tabs
    city-picker.tsx     # bottom sheet
    events/[slug].tsx   # PRD-0005
    communities/[slug].tsx # PRD-0006
```

Deep link: `indlokal://discover/:citySlug` and Universal Link `https://indlokal.com/:citySlug`.

## 5. Push / Email / Inbox triggers

- Implicit: viewed events feed `track` event → `modules/scoring`.

## 6. Feature flags

- `mobile.discover.trending_rail.enabled`

## 7. Observability

- `discover.feed.viewed{citySlug}`, `discover.card.tapped{type}`.
- Sentry breadcrumbs for query failures.

## 8. Failure modes & fallbacks

- Network error → render last cached page; show retry chip.
- City inactive → show "Coming soon" CTA mirroring web `coming-soon` page.

## 9. Test plan

- Unit: card components, date formatting, locale.
- Contract: discovery endpoints.
- E2E (Detox): city switch, pull-to-refresh, offline path.

## 10. Rollout plan

- Ship to internal beta in Stuttgart only; expand to all active cities once metrics are met.

## 11. Backout plan

- Disable trending rail flag; feed itself has no flag (core).
