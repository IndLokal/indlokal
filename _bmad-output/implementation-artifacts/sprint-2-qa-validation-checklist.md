# Sprint 2 QA Validation Checklist (Resources Improvement)

Date: 2026-06-10
Scope: Story 3.1, 2.2, 4.1 (plus save-control UX polish)
Validator: Amelia implementation pass + QA/UAT evidence checks

## Sprint 2 Closeout Decision (John - 2026-06-10)

Decision: Sprint 2 is formally closed.

Closeout mode:

- Closed by product-owner override after implementation completion, targeted automated validation, and web spot-check evidence.
- Pending QA and ranking-validation gates are converted into mandatory post-close commitments.

Accepted risks at close:

- Screenshot evidence bundle incomplete at close time.
- Mobile parity QA incomplete at close time.
- Logged-out save redirect, cross-device persistence, and rapid-toggle resilience checks incomplete at close time.
- Story 4.1 live ranking-validation gate incomplete at close time.

## 1. Automated Validation

### Build/Type Safety

- Web typecheck: pass (`pnpm -F web typecheck`)

### Targeted Test Evidence

- Command:
  - `pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts src/modules/engagement/__tests__/engagement.test.ts src/modules/community/__tests__/queries.integration.test.ts`
- Result:
  - 3 test files passed
  - 23 tests passed
  - 0 failed

### Implementation Evidence (Code Presence)

Story 3.1 (Related communities/events bridge):

- Hub bridge modules present in:
  - `apps/web/src/app/[city]/resources/page.tsx`
- Category bridge modules present in:
  - `apps/web/src/app/[city]/resources/[category]/page.tsx`
- Journey bridge modules present in:
  - `apps/web/src/app/[city]/resources/journey/page.tsx`

Story 2.2 (Save and remind support loop):

- Event save/remind controls present in related event cards:
  - `apps/web/src/app/[city]/resources/page.tsx`
  - `apps/web/src/app/[city]/resources/[category]/page.tsx`
  - `apps/web/src/app/[city]/resources/journey/page.tsx`
- Resource account-backed save control present (SavedResource persistence + optimistic server action + auth redirect) in:
  - `apps/web/src/components/ResourceSaveButton.tsx`
- SavedResource schema and join-table persistence present in:
  - `apps/web/prisma/schema.prisma`
  - `apps/web/prisma/migrations/20260610173000_add_saved_resources/migration.sql`
- Resource save server action and engagement path present in:
  - `apps/web/src/app/actions/saves.ts`
  - `apps/web/src/modules/engagement/index.ts`
- Profile and API visibility for account-backed resources present in:
  - `apps/web/src/app/me/page.tsx`
  - `apps/web/src/app/api/v1/me/engagement/route.ts`
- Save event mapping in tracking route:
  - `apps/web/src/app/api/v1/track/route.ts`

Story 4.1 (Ranking policy foundations):

- Resolver-level story readiness remains dependent on ranking rollout path and live gate checks.
- No regression detected in current resolver/query tests.

Save-control UX polish:

- Repeated helper copy removed from category and journey cards.
- Save control updated to compact visual style (`Save`/`Saved`) to reduce card noise.

## 2. Manual QA Matrix (Sprint 2 Surfaces)

1. Resources hub (`/[city]/resources`)

- Verify related communities/events module renders when category context exists.
- Verify event save control toggles without layout shift.
- Verify resource save control is visible but visually low-noise.

2. Resources category (`/[city]/resources/[category]`)

- Verify related communities/events module renders with valid links.
- Verify event save control and reminder helper copy clarity.
- Verify resource save control does not crowd description/CTA area.

3. Resources journey (`/[city]/resources/journey`)

- Verify related communities/events module renders and links resolve.
- Verify event save control toggles and page remains stable.
- Verify resource save control is compact and not repetitive per card.

4. Profile visibility and state clarity (`/me`)

- Verify `Saved Resources` section appears and reflects account-backed resource saves.
- Verify save on resource surfaces is reflected in `/me` `Saved Resources`.
- Verify `Journey Bookmarks On This Device` remains journey-only context.

## 2A. Manual QA Results (Web Run - 2026-06-10)

Environment:

- URL tested: `http://localhost:3001/stuttgart/resources`
- DB and app services running locally.

Passed:

1. Hub essentials save controls render with compact `Save` style.
2. Category resource cards render compact save control without repeated helper sentence.
3. Related bridge modules remain visible on resources surfaces where data is available.
4. Account-backed save control placement verified in-card across hub/category/journey.
5. No type or targeted test regressions after save architecture + UX updates.

Pending at close time (converted to post-close commitments):

1. Full screenshot bundle for Sprint 2 evidence (hub, category, journey, profile Saved Resources).
2. Mobile parity run for save-control visual behavior.
3. Cross-device verification for resource saves (save on session A visible on session/device B).
4. Unauthenticated save behavior verification (redirect to login + clean return).
5. Rapid-toggle and transient failure resilience check for optimistic save state.
6. Live ranking signal validation for Story 4.1 once rollout path is active.

## 2B. Quick UAT Script (Sprint 2)

Preconditions:

- Web running locally on port 3001.
- Test account logged in for event save/remind checks.

Execution steps:

1. Open `/stuttgart/resources`.

- Expected: related modules and compact save controls render without overlap.
- Result: [ ] Pass [ ] Fail
- Notes:

2. Save one essentials resource, then unsave.

- Expected: button toggles `Save` <-> `Saved`; no visual jump in card layout.
- Result: [ ] Pass [ ] Fail
- Notes:

3. Open one category page and repeat resource save toggle.

- Expected: compact control remains aligned; no repeated helper text.
- Result: [ ] Pass [ ] Fail
- Notes:

4. Save one related event.

- Expected: save action succeeds; reminder copy remains readable and non-blocking.
- Result: [ ] Pass [ ] Fail
- Notes:

5. Open `/me` and verify account-backed resource listing.

- Expected: saved resource appears under `Saved Resources` and remains after refresh/new session.
- Result: [ ] Pass [ ] Fail
- Notes:

6. Verify logged-out save behavior.

- Action: while logged out, tap resource `Save`.
- Expected: redirect to `/me/login`; after login, save flow remains stable without duplicate toggles.
- Result: [ ] Pass [ ] Fail
- Notes:

7. Verify cross-device/session persistence.

- Action: save a resource in session/device A, then open same account in session/device B.
- Expected: resource appears as `Saved` and in `/me` `Saved Resources`.
- Result: [ ] Pass [ ] Fail
- Notes:

8. Verify rapid-toggle resilience.

- Action: tap `Save`/`Saved` quickly multiple times on one resource.
- Expected: final UI state matches final persisted account state; no stale visual lock.
- Result: [ ] Pass [ ] Fail
- Notes:

Exit criteria:

- All applicable steps pass.
- No clipped text, button overlap, or CTA displacement in resources cards.
- Save states remain stable after route navigation.

## 3. Acceptance Gate Summary

Story 3.1 Related communities and events bridge

- Criteria status: complete in code
- QA status: closed with accepted risk (web checks passed; evidence bundle moved to post-close)

Story 2.2 Save and remind support loop

- Criteria status: complete in code (event save/remind + account-backed resource save across devices)
- QA status: closed with accepted risk (mobile parity and advanced behavior checks moved to post-close)

Story 4.1 Ranking updates trust/freshness weighting

- Criteria status: partial (test-safe foundation; live rollout validation pending)
- QA status: closed with deferred ops gate (live ranking validation moved to post-close)

## 4. Post-Close Commitments (Mandatory)

1. Capture full screenshot evidence for hub, category, journey, and profile Saved Resources. (Owner: Amelia + QA, Due: 2026-06-12)
2. Run mobile parity QA for Sprint 2 save-control and related bridge surfaces. (Owner: Amelia + QA, Due: 2026-06-12)
3. Complete logged-out redirect, cross-device persistence, and rapid-toggle resilience checks for Story 2.2. (Owner: FE Web + QA, Due: 2026-06-13)
4. Validate Story 4.1 ranking behavior against live data gates before marking Ready for Review. (Owner: Data + FE, Due: 2026-06-14)
