# TDD-0013: Pipeline review & submissions queue scoping

- **Status:** Shipped
- **Linked PRD:** PRD-0013
- **Owner:** Founders

## 1. Architecture overview

Three small surgical changes:

1. `apps/web/src/app/admin/(dashboard)/submissions/page.tsx` — narrow the
   list query.
2. `apps/web/src/modules/pipeline/review.ts` — pass an explicit status
   when materializing a pipeline extraction into a `Community`.
3. `apps/web/prisma/directory.ts` — change default insert status.

## 2. Data model

No schema changes. We only flip values of `Community.status` and rely on
the existing `Community.source` enum (`USER_SUBMITTED`,
`COMMUNITY_SUBMITTED`, `ADMIN_SEED`, `IMPORTED`).

A one-shot data backfill is documented in §5.

## 3. Code changes

### 3.1 Submissions list query

`apps/web/src/app/admin/(dashboard)/submissions/page.tsx`:

```ts
const submissions = await prisma.community.findMany({
  where: {
    status: 'UNVERIFIED',
    source: 'COMMUNITY_SUBMITTED',
  },
  // ...orderBy / include unchanged
});
```

This excludes `ADMIN_SEED` (directory bootstrap) and `IMPORTED`
(AI pipeline output) from the queue.

### 3.2 Pipeline review

`apps/web/src/modules/pipeline/review.ts`:

```ts
export async function createCommunityFromExtraction(
  community: ExtractedCommunity,
  cityId: string,
  status: CommunityStatus = 'UNVERIFIED', // default for auto-approved path
): Promise<Community> {
  /* ... */
}

export async function approvePipelineItemRecord(
  itemId: string,
  { adminApproved }: { adminApproved: boolean },
) {
  const targetStatus: CommunityStatus = adminApproved ? 'ACTIVE' : 'UNVERIFIED';
  // ...
  await createCommunityFromExtraction(extracted, cityId, targetStatus);
}
```

### 3.3 Directory seed default

`apps/web/prisma/directory.ts` (line 569):

```ts
status: 'ACTIVE' satisfies CommunityStatus,
```

## 4. API surface

No public API changes. Internal admin route handlers only.

## 5. Backfill

One-shot SQL run against the production DB after deploy:

```sql
UPDATE communities
SET status = 'ACTIVE'
WHERE status = 'UNVERIFIED'
  AND source IN ('ADMIN_SEED', 'IMPORTED');
```

This flips legacy rows that were planted before the defaults were
corrected.

## 6. Observability

- The submissions page header shows the count from the scoped query, so
  any regression (e.g. accidentally widened filter) is immediately
  visible to founders.
- Approval action logs `{ pipelineItemId, communityId, status }`.

## 7. Failure modes

| Failure                                    | Behavior                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Backfill SQL not run                       | Old `UNVERIFIED` seeded rows linger as silent backlog; mitigated by the source filter on the queue. |
| `adminApproved` plumbing regresses         | Approval re-creates the loop; covered by manual smoke test in test plan.                            |
| Future `Community.source` enum value added | Won't appear in queue until added to the explicit filter — intentional.                             |

## 8. Test plan

- Unit: `approvePipelineItemRecord` with `adminApproved=true|false`
  asserts resulting community status.
- Smoke: submit one community via the public form → it appears in the
  queue. Run pipeline ingest → does NOT appear. Approve from pipeline →
  community is `ACTIVE` and not in the queue.

## 9. Rollout

Shipped. The scoped query and seed default went out with the same
commit; the SQL backfill is a one-shot.

## 10. Backout

Revert the three code changes. The backfill is forward-only; rows can be
flipped back with the inverse `UPDATE` if absolutely needed.
