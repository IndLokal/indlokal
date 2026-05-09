# TDD-0012: Admin data management console

- **Status:** Shipped
- **Linked PRD:** PRD-0012
- **Owner:** Founders

## 1. Architecture overview

All work lives under `apps/web/src/app/admin/(dashboard)/data/`. Each
entity has a list page that fetches via Prisma in a server component and
renders a small client island for the delete buttons. Mutations are
implemented as React Server Actions in `data/actions.ts` and wrapped with
`requireAdmin()` from the session module.

```
/admin/data/                       page.tsx       (tiles + bootstrap button)
/admin/data/cities/                page.tsx       (table + Delete)
/admin/data/communities/           page.tsx
/admin/data/events/                page.tsx
/admin/data/resources/             page.tsx
                                   actions.ts     (deleteCity / Community / Event / Resource)
```

## 2. Data model

No schema changes. Operates on existing tables.

## 3. Server actions (signatures)

```ts
// apps/web/src/app/admin/(dashboard)/data/actions.ts
'use server';
deleteCityAction(cityId: string):       Promise<ActionResult>
deleteCommunityAction(communityId: string): Promise<ActionResult>
deleteEventAction(eventId: string):     Promise<ActionResult>
deleteResourceAction(resourceId: string): Promise<ActionResult>
```

Common contract:

1. `await requireAdmin()` — throws redirect to `/admin/login` if unauth.
2. Run the entity-specific check / cascade (see §4).
3. `revalidateTag('city-feed', 'max')`.
4. Return `{ ok: true }` or `{ ok: false, error: string }`.

### deleteCityAction (reference-safe)

Counts in parallel: communities, events, resources, users (with
`primaryCityId`), reports targeting the city, child cities. If any count
is non-zero, returns:

```
"Cannot delete: 3 communities, 2 events. Delete or reassign them first."
```

### deleteCommunityAction (transactional)

Inside one `prisma.$transaction`:

1. `event.updateMany({ where: { communityId }, data: { communityId: null } })`
2. `community.updateMany({ where: { mergedIntoId: communityId }, data: { mergedIntoId: null } })`
3. `report.deleteMany({ where: { communityId } })`
4. `community.delete({ where: { id: communityId } })`

### deleteEventAction / deleteResourceAction

Single delete + cache revalidate. Foreign keys on `Bookmark` etc. are
configured with `ON DELETE CASCADE` already; no manual fan-out needed.

## 4. Authorization

`requireAdmin()` (from `lib/session.ts`) verifies the cookie, looks up the
session row, and confirms the user has `role = ADMIN`. Same gate guards
the list pages via the existing `/admin/(dashboard)/layout.tsx`.

## 5. Cache invalidation

Every mutation calls `revalidateTag('city-feed', 'max')`. This tag is
attached to the public city feed loader (`lib/city-feed.ts`). Deletes
become visible to anonymous web visitors on their next request without
waiting for ISR.

## 6. Observability

- Server-side `console.log` per action with `{ entity, id, adminId }`.
- Sentry breadcrumb on action entry.
- Failed deletes are returned as data, not thrown — the form surfaces
  them to the admin.

## 7. Failure modes

| Failure                                 | Behavior                                           |
| --------------------------------------- | -------------------------------------------------- |
| Unauth user crafts the action call      | `requireAdmin()` redirects to login.               |
| City has dependent rows                 | Action returns enumerated counts; nothing mutated. |
| Transaction rollback (community delete) | Returns `{ ok:false }`; nothing partially deleted. |
| `revalidateTag` throws                  | Caught and logged; mutation already committed.     |

## 8. Test plan

- Unit: `deleteCityAction` ref-count gating with mocked Prisma.
- Integration: seed a community with events + reports; assert
  transactional cleanup leaves no orphans.
- Smoke: round-trip in dev Mailpit + admin auth.

## 9. Rollout

Shipped behind admin auth. No flag.

## 10. Backout

Revert the `data/` route + `actions.ts`. Schema unchanged.
