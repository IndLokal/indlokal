# TDD-0003: Mobile Discover feed

- **Status:** Draft
- **Linked PRD:** PRD-0003

## 1. Architecture overview

- Mobile screens under `apps/mobile/app/`; the Discover home is `(tabs)/index.tsx`.
- Data via a lightweight in-memory `queryCache` helper (`apps/mobile/lib/cache/query-cache.ts`)
  with TTL + de-duplication, calling `/api/v1/discovery/*` directly via `authClient`.
  TanStack Query was evaluated but not adopted for v1 — `queryCache` covers the use
  case in ~50 lines with zero added dependencies.
- Server reuses `src/modules/discovery/queries.ts`; thin handlers under
  `apps/web/src/app/api/v1/discovery/`.
- Offline cache is in-memory per session. AsyncStorage persistence across cold
  starts is a follow-up.

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
  index.tsx              # Discover home — chip-rail city picker + tabs
                         # (This-week / Communities / Resources)
events/[slug].tsx        # PRD-0005 (top-level so it is reachable from
                         # search, bookmarks, push notifications, etc.)
communities/[slug].tsx   # PRD-0006 (top-level for the same reason)
resources.tsx            # PRD-0010 grouped resources
```

Deep link: `indlokal://discover/:citySlug` and Universal Link `https://indlokal.com/:citySlug`.
Universal Links also route directly to event/community detail and to
`/auth/magic-link/verify` for the magic-link flow.

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
