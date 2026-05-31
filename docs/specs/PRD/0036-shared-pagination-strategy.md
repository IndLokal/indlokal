# PRD-0036: Shared pagination strategy

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0036

## 1. Problem

IndLokal is accumulating list surfaces across admin, organizer, public web, mobile, and API routes. Several pages already protect themselves with hard caps or one-off pagination, but there is no shared pagination contract.

Current pain:

- Admin data pages use fixed `take: 200` caps that silently hide rows once the catalog grows.
- Existing paginated pages use local query param names and controls, so behavior will drift.
- Filters, sorting, and reset behavior are not tied to a canonical page reset rule.
- Multi-list pages need namespaced pagination without breaking other filters.
- Mobile/API feeds will need cursor semantics, while admin tables need predictable page numbers.

This matters before broad content growth because pagination affects correctness, operator trust, perceived performance, and URL shareability.

## 2. Users & JTBD

- **Platform admin:** I need every operational table to show complete results with predictable navigation so that no content is hidden behind arbitrary caps.
- **Organizer:** I need manageable event/collaborator/community lists so that workspace operations stay fast as my activity grows.
- **Mobile user:** I need smooth feed continuation so that browsing does not feel interrupted or duplicated.
- **Developer:** I need one pagination contract and reusable helpers so that new list pages do not reinvent query parsing, metadata, and controls.

## 3. Success Metrics

- 100% of admin list pages with unbounded growth use shared pagination instead of silent fixed caps.
- 0 known list pages display more than the configured maximum page size.
- 0 pagination links drop active filters or sort parameters.
- p95 server render time for paginated admin list pages stays below 1.5s on production data.
- Pagination support issues or operator reports of “missing rows” trend to zero after rollout.

Analytics/events to define only where useful:

- `pagination_page_changed`
- `pagination_page_size_changed`
- `pagination_invalid_page_normalized`

## 4. Scope

In scope:

- Shared pagination rules for web server-rendered pages, admin pages, organizer pages, API responses, and mobile feeds.
- Shared web utilities for parsing page/pageSize query params, building pagination metadata, and preserving filters.
- Shared pagination UI for admin/organizer table/list surfaces.
- Canonical behavior for filters, sorting, reset links, empty pages, invalid params, and multiple paginated lists on one route.
- Migration plan for existing capped admin pages and existing one-off pagination.

## 5. Out of Scope

- Infinite scroll for admin or organizer work surfaces.
- Virtualized table/grid rendering.
- Replacing mobile feed ranking logic.
- Export pagination; exports should continue to use explicit export caps and async export patterns where needed.
- Database sharding or read replicas.

## 6. User Stories

- As an admin, I want to move through all communities/events/resources without hidden caps so that operations remain trustworthy.
- As an admin, I want filters and sorting to persist when changing pages so that I do not lose my current view.
- As an admin, I want filters to reset pagination back to page 1 so that I do not land on an empty deep page after narrowing results.
- As an organizer, I want event and collaborator lists to paginate consistently so that workspace management scales beyond small teams.
- As a mobile user, I want feeds to load more items without duplicates or jumps so that browsing feels continuous.
- As a developer, I want one helper/component pattern so that pagination is cheap and consistent to add.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given an admin data table has more rows than one page
When the admin opens the table
Then the first page shows the configured page size
And the UI shows the visible range, total count when available, and next/previous controls
```

```gherkin
Given an admin has selected filters and sort order
When they click Next
Then the next page URL preserves all active filters and sort parameters
And only the page parameter changes
```

```gherkin
Given an admin is on page 5
When they apply or reset filters
Then the resulting URL resets that list to page 1
```

```gherkin
Given a route contains two independent paginated lists
When the user changes the second list page
Then the first list page and shared filters are preserved
```

```gherkin
Given a user requests an invalid page or pageSize
When the page loads
Then the server normalizes to the nearest allowed value
And the UI renders a valid page without throwing
```

```gherkin
Given a mobile API feed returns a page of results
When additional results exist
Then the response includes a next cursor
And the next request does not duplicate already returned items
```

## 8. UX

Web/admin/organizer requirements:

- Use numbered page navigation for task-oriented admin/organizer lists.
- Show concise range text: `Showing 26-50 of 342` when exact totals are available.
- Show `Showing 26-50` plus next/previous when exact totals are intentionally skipped.
- Keep controls below the list; add top controls only for long or dense tables after first implementation.
- Disable previous/next at boundaries.
- Preserve all active filters and sort labels visibly near the list.
- Reset links clear filters and page state together.
- Page-size picker is optional in v1; where exposed, allowed sizes are 10, 25, 50, 100.

Mobile/API requirements:

- Feed/list APIs use cursor-based pagination.
- Mobile uses “Load more” or feed continuation patterns, not numbered pages.
- Empty state distinguishes “no results for filters” from “end of list”.

Accessibility:

- Pagination controls use semantic nav with `aria-label`.
- Current page is announced with `aria-current="page"`.
- Disabled controls are non-clickable and announced as disabled.
- Link text must be descriptive enough for screen readers.

## 9. Strategy

Canonical model:

- Use **URL-driven offset pagination** for admin and organizer server-rendered pages.
- Use **cursor pagination** for mobile/API feeds and any high-churn public feeds.
- Use stable ordering for every paginated query, always with an id tie-breaker.
- Use exact counts for admin/organizer pages where operator range context matters and the query is indexed.
- Use sentinel fetch (`take + 1`) instead of exact counts for high-volume feeds where total count is not product-critical.

Default web contract:

- Param names: `page` and `pageSize` for single-list pages.
- Namespaced params for multi-list pages: `<scope>Page`, `<scope>PageSize` such as `requestPage`.
- Default page size: 25.
- Maximum page size: 100.
- Invalid page values normalize to 1.
- Filter/sort changes reset the affected page param to 1.
- Pagination links preserve every unrelated query param.

Implementation priority:

1. Build shared helpers and admin pagination component.
2. Migrate admin data pages currently capped at 200: communities, events, resources.
3. Consolidate existing admin audit and collaborators pagination onto the shared helpers.
4. Add pagination to pipeline history/review subsections where queues can grow.
5. Add organizer events/collaborator pagination as workspace surfaces mature.
6. Align public/mobile API pagination contracts where list endpoints need continuation.

## 10. Risks & Open Questions

Risks:

- Exact counts can become expensive on highly filtered tables without indexes.
- Offset pagination can show shifted rows when data changes during navigation.
- Too many page-size options can add UI noise to operator pages.
- Cursor and offset contracts can diverge if shared types are not documented clearly.

Open questions:

- Should admin pages expose page-size selection in v1 or keep a fixed 25-row default?
- Which public web pages should stay SEO-oriented numbered pagination versus cursor/“load more” continuation?
- Do we need a shared table abstraction, or only pagination helpers and controls for now?
- Should analytics track pagination interaction globally or only on high-value surfaces?
