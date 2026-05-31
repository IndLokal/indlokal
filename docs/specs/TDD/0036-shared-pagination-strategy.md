# TDD-0036: Shared pagination strategy

- **Status:** Draft
- **Linked PRD:** PRD-0036
- **Owner:** Founders

## 1. Architecture overview

Pagination should be implemented as a small shared contract, not as a table framework.

Core pieces:

- Query parsing helpers for URL-driven web pagination.
- Metadata builders for exact-count and sentinel pagination.
- Link builders that preserve filters/sort and mutate only pagination params.
- Shared admin/organizer pagination controls.
- Cursor response schemas for mobile/API feeds.

Recommended files:

- `apps/web/src/lib/pagination.ts`
- `apps/web/src/components/ui/PaginationControls.tsx`
- `packages/shared/src/pagination.ts`
- Route-specific migrations under `apps/web/src/app/admin/**`, `apps/web/src/app/organizer/**`, and API routes as needed.

Design principle:

- Pages own their filtering/sorting semantics.
- Shared pagination utilities own param parsing, clamping, metadata, and link construction.

## 2. Data model changes

No schema changes are required for the pagination foundation.

Indexes to verify before migrating each page:

- `Community`: indexes supporting admin filters by city/status/claimState plus stable ordering by `updatedAt, id`.
- `Event`: indexes supporting city/status/date views plus stable ordering by `startsAt, id` or `updatedAt, id`.
- `Resource`: indexes supporting city/type views plus stable ordering by `updatedAt, id`.
- `AuditLog`: indexes supporting `createdAt, id` and common filters.
- `CommunityCollaborator`: indexes supporting community/status/source views.
- `PipelineItem`: indexes supporting status/confidence/createdAt review queues.

If an exact-count query is slow, prefer adding a targeted index before replacing operator counts with approximate behavior.

## 3. API surface

Shared types in `packages/shared/src/pagination.ts`:

```ts
export type OffsetPaginationParams = {
  page?: number;
  pageSize?: number;
};

export type OffsetPaginationMeta = {
  page: number;
  pageSize: number;
  totalCount?: number;
  totalPages?: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  from: number;
  to: number;
};

export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type CursorPaginationMeta = {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
};
```

Web helper contracts in `apps/web/src/lib/pagination.ts`:

```ts
type ParsePaginationOptions = {
  pageParam?: string;
  pageSizeParam?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
};

function parseOffsetPagination(
  searchParams: Record<string, string | string[] | undefined>,
  options?: ParsePaginationOptions,
): { page: number; pageSize: number; skip: number; take: number };

function buildOffsetPaginationMeta(args: {
  page: number;
  pageSize: number;
  totalCount?: number;
  itemCount: number;
  fetchedWithSentinel?: boolean;
}): OffsetPaginationMeta;

function buildPageHref(args: {
  searchParams: URLSearchParams | Record<string, string | undefined>;
  pageParam?: string;
  page: number;
  resetParams?: string[];
}): string;
```

Endpoint table:

| Method | Path                             | Auth              | Request                                      | Response                             |
| ------ | -------------------------------- | ----------------- | -------------------------------------------- | ------------------------------------ |
| GET    | server-rendered admin routes     | platform admin    | `page`, `pageSize`, filters, sort            | HTML with shared pagination controls |
| GET    | server-rendered organizer routes | organizer session | namespaced `page`, `pageSize`, filters, sort | HTML with shared pagination controls |
| GET    | mobile/API list routes           | route-specific    | `cursor`, `limit`, filters, sort             | JSON list + `CursorPaginationMeta`   |

## 4. Web screens & navigation

Admin migration targets:

- `/admin/data/communities`
- `/admin/data/events`
- `/admin/data/resources`
- `/admin/audit`
- `/admin/collaborators`
- `/admin/pipeline`
- `/admin/scoring`
- `/admin/merge`

Organizer migration targets:

- `/organizer/communities`
- `/organizer/collaborators`
- `/organizer/events`

Navigation behavior:

- Single-list pages use `page` and `pageSize`.
- Multi-list pages use namespaced params, e.g. `communityPage` and `requestPage`.
- Pagination controls must preserve unrelated filters and unrelated list page params.
- Filter forms must omit the affected page param or set it to `1` when submitted.
- Reset links must remove filters and the affected page/pageSize params together unless a page size has been intentionally selected.

## 5. Push / Email / Inbox triggers

No push, email, or inbox triggers are required.

## 6. Feature flags

Recommended flag:

- `shared_pagination_v1`

Default behavior:

- Build helpers and components without changing routes.
- Migrate one surface at a time.

Kill-switch behavior:

- Keep old route-specific pagination logic until a migrated page is verified.
- For each route migration, rollback can restore the previous local query logic without schema changes.

## 7. Observability

Logs / diagnostics:

- Log invalid page/pageSize normalization at debug level, not error level.
- Add route-level timing around heavy count queries where available.

Metrics/events:

- `pagination_invalid_page_normalized` for repeated bad-link diagnosis.
- `pagination_page_changed` only on high-value operator flows if product wants interaction analytics.
- Track server timing for migrated pages via existing request/runtime monitoring.

Sentry tags for pagination-related errors:

- `surface=admin|organizer|api|mobile`
- `route`
- `page`
- `pageSize`
- `paginationMode=offset|cursor`

## 8. Failure modes & fallbacks

- Invalid page (`0`, negative, non-number): normalize to page 1.
- Invalid page size: clamp to allowed range, default to 25 if not parseable.
- Page beyond total pages: render the last valid page or redirect to the last valid page after count is known.
- Empty result after data deletion: show empty state with Previous link if page > 1.
- Slow exact count: add/verify index; if still too slow, switch that surface to sentinel pagination and remove total count copy.
- Cursor tampering: treat invalid cursor as bad request for API routes or restart from first page for non-sensitive feeds.
- Concurrent inserts/deletes: rely on stable order and id tie-breakers; do not promise snapshot consistency for v1.

## 9. Test plan

- Unit:
  - parse default page/pageSize
  - clamp invalid page/pageSize
  - namespaced params for multi-list pages
  - exact-count metadata from/to/totalPages
  - sentinel metadata hasNextPage behavior
  - link builder preserves filters and resets page params correctly
- Integration:
  - admin data communities pagination preserves filters
  - admin data events pagination preserves status/city filters
  - admin resources pagination preserves type/city filters
  - existing audit pagination produces equivalent URLs through shared helpers
  - collaborators page supports independent community/request page params
- Contract:
  - API list schemas expose cursor meta consistently when added
  - OpenAPI examples include `nextCursor` and `hasNextPage`
- E2E:
  - admin changes pages and keeps active filters
  - filter submit returns to page 1
  - reset filters clears page state
  - mobile feed “load more” does not duplicate items when API implementation starts
- Load:
  - benchmark exact-count admin pages against production-like row counts before migration is marked shipped

## 10. Rollout plan

1. Add shared types, helpers, and `PaginationControls` behind no route behavior change.
2. Migrate `/admin/data/communities` as the reference admin table.
3. Migrate `/admin/data/events` and `/admin/data/resources`.
4. Consolidate `/admin/audit` and `/admin/collaborators` onto shared helpers without changing visible behavior.
5. Apply the same pattern to pipeline/scoring/merge list surfaces.
6. Add organizer pagination where workspace lists exceed one page.
7. Introduce cursor schemas for mobile/API list endpoints as each endpoint needs continuation.

## 11. Backout plan

- Revert individual route migrations to previous local query logic.
- Keep shared helpers/components in place if unused; they do not require schema changes.
- If count queries regress performance, temporarily switch the affected route to sentinel pagination or restore the prior capped query while adding indexes.
- Disable `shared_pagination_v1` only for surfaces that are flag-gated.
