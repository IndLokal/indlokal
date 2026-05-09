# PRD-0012: Admin data management console (CRUD + safe delete)

- **Status:** Shipped
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0012, PRD-0011 (auth), PRD-0013 (submissions queue)

## 1. Problem

The admin had no first-class surface to inspect or remove platform data.
Bad rows from imports, duplicate cities, abandoned communities, and
mistakenly approved events accumulated, and the only way to fix them was
direct SQL. That:

- gated cleanup on a developer at a laptop with database access,
- risked dangerous deletes (no relationship checks),
- made it impossible to demonstrate "we can manage our own platform" in
  consulate / partner conversations.

## 2. Users & JTBD

- **Platform admin** — wants to browse cities, communities, events, and
  resources, and remove duplicates or stale rows safely.
- **Platform admin** — wants to see counts ("how many communities in
  Stuttgart?") at a glance.

## 3. Success Metrics

- 0 SQL-console deletes performed by founders after rollout.
- Mean time to remove a duplicate community ≤ 60 s from spotting it.
- Zero cascade-delete accidents (no city deleted with live communities).

## 4. Scope

- `/admin/data` dashboard with tiles for Cities, Categories, Communities,
  Events, Resources.
- List pages for each, with search and obvious filters (city, type,
  status).
- Server actions to **delete** a city, community, event, or resource.
- Reference-safe city delete: refuses if the city has any communities,
  events, resources, users, reports, or child cities — the error tells
  the admin exactly which counts are non-zero.
- Transactional community delete: detaches events, clears merge pointers,
  drops reports, then deletes — in one Prisma `$transaction`.
- Cache invalidation: every mutating action calls
  `revalidateTag('city-feed', 'max')` so the public site reflects deletes
  immediately.

## 5. Out of Scope

- Inline edit of community / event content (use the existing detail
  pages).
- Bulk delete / bulk merge.
- Undo / soft-delete (deferred — current rows are deleted hard).
- Audit log UI (server logs only for now).

## 6. User Stories

- As an admin I want to open `/admin/data` and see how many of each entity
  exist, so I have a sense of platform health.
- As an admin I want to delete a duplicate community in two clicks and have
  the public city page reflect it immediately.
- As an admin I want a city delete to fail loudly when the city still has
  content, so I never orphan rows.

## 7. Acceptance Criteria

```
Given an admin opens /admin/data
 When the page renders
 Then they see tiles for Cities, Categories, Communities, Events, Resources
      with current counts.

Given an admin clicks "Delete" on a city that has communities
 When the action runs
 Then it returns an error message naming each non-zero relationship count
      and the city is NOT deleted.

Given an admin clicks "Delete" on a community
 When the action runs
 Then events are detached, merge pointers cleared, reports removed,
      and the community row is deleted, all in one transaction.

Given an admin deletes any entity
 When the action commits
 Then the public city feed cache is revalidated within the same request.
```

## 8. UX

- `/admin/data` — tile grid: "Cities (n)", "Categories (n)",
  "Communities (n)", "Events (n)", "Resources (n)", plus a "Run bootstrap"
  button (re-runs the idempotent bootstrap seed — see ADR-0003).
- `/admin/data/{cities,communities,events,resources}` — table with
  search + filters, each row has a "Delete" button with `confirm()`
  prompt.
- Inline error toast for refused city delete.

## 9. Risks & Open Questions

- **Risk:** hard delete of a community discards history. Acceptable for
  now because we have no public history UI, but reconsider before adding
  one.
- **Open:** add an admin-visible audit log (who deleted what, when).
- **Open:** soft-delete + restore window (deferred until there's a
  request).
