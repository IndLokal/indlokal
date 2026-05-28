# TDD-0031: Submission ownership and claim lifecycle alignment

- **Status:** Draft
- **Linked PRD:** PRD-0031
- **Owner:** Founders

## 1. Architecture overview

Touchpoints:

1. Public submission intake (`apps/web/src/app/submit/actions.ts`)
2. Admin submission approval (`apps/web/src/app/admin/(dashboard)/actions.ts`)
3. Community claim UI (`apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx`)
4. Organizer auth eligibility (`apps/web/src/app/organizer/login/actions.ts`)

Design principle:

- `status` answers content lifecycle (`UNVERIFIED`/`ACTIVE`/`INACTIVE`).
- `claimState` + `claimedByUserId` answer ownership lifecycle.

## 2. Data model changes

Phase A (interim, shipped):

- No schema migration.
- Admin approval may set `claimState='CLAIMED'` and `claimedByUserId` from submission metadata.

Phase B (recommended):

- Add ownership-intent fields to community metadata OR dedicated columns:
  - `submissionOwnershipIntent` (boolean)
  - `submissionOwnershipEvidence` (json/text optional)
- Optional audit table for admin ownership decision (if needed for compliance).

## 3. Workflow states

Submission approval decision matrix:

1. `ACTIVE + CLAIMED`: content approved and ownership granted.
2. `ACTIVE + UNCLAIMED`: content approved, ownership not granted.
3. `UNVERIFIED + UNCLAIMED`: pending review.
4. `INACTIVE + UNCLAIMED`: rejected/retired.

Guardrails:

- Never overwrite existing non-null `claimedByUserId` during submission approval unless admin explicitly chooses reassignment.
- Only grant `COMMUNITY_ADMIN` when ownership is granted.

## 4. API/action surface

Server actions involved:

- `submitCommunity` - capture ownership intent + optional evidence.
- `approveSubmission` - applies status + claim decision atomically.
- `approveClaim` / `rejectClaim` - unchanged semantics for independent claim flow.

Related UX/email surfaces (shipped):

- `apps/web/src/lib/email.ts` (`sendSubmissionApprovedEmail` ownership-granted CTA update)
- `apps/web/src/app/organizer/login/page.tsx` (prefill `email` query param)
- `apps/web/src/app/admin/(dashboard)/submissions/page.tsx`
- `apps/web/src/app/admin/(dashboard)/submissions/ApproveSubmissionForm.tsx`

No public API contract changes required in Phase A.

## 5. Revalidation and cache

On ownership/status change during approval:

- Revalidate city feed tag: `city-feed`
- Revalidate community detail path: `/{city}/communities/{slug}`
- Revalidate community list path: `/{city}/communities`
- Revalidate admin submissions page

## 6. Observability

Add structured logs/analytics on admin approval:

- `submission_approved` with `ownership_granted: true|false`
- `owner_user_created: true|false`
- `owner_user_promoted: true|false`

Dashboard checks:

- Count of `ACTIVE + UNCLAIMED` for `source=COMMUNITY_SUBMITTED`
- Count of organizer login failures for approved submitter emails

## 7. Failure modes and fallbacks

- Missing/invalid submitter email:
  - Fallback to `ACTIVE + UNCLAIMED`, no owner link.
- User upsert fails:
  - Do not block content approval unless transaction policy requires all-or-nothing.
- Stale UI after approval:
  - Revalidate tag + paths in approval action.

## 8. Test plan

- Unit:
  - `approveSubmission` sets `ACTIVE + CLAIMED` when ownership granted.
  - `approveSubmission` sets `ACTIVE + UNCLAIMED` when ownership not granted.
  - existing owner is not overwritten without explicit reassignment.
- Integration:
  - Submit -> approve -> community page hides "Claim this community" when claimed.
  - Submit -> approve(no ownership) -> CTA remains visible.
  - Approved owner can request organizer magic link.
- Backfill dry run:
  - report candidate rows and expected ownership mappings before write.

## 9. Rollout plan

1. Ship interim auto-claim behavior (already done).
2. Add ownership-intent capture in submission form.
3. Add admin explicit toggle/decision in approval UI.
4. Run backfill for historical rows with clear owner mapping.
5. Monitor mismatch metrics for two weeks.

## 10. Backout plan

- Disable ownership linking in `approveSubmission` (status approval remains).
- Keep claim flow (`CLAIM_PENDING -> CLAIMED`) as fallback route.
- Re-run correction script to reset unintended owner links where required.

## 11. Shipped Delta (2026-05-27)

1. Approval email copy and CTA now explicitly guide ownership-granted users to organizer access instead of only public listing view.
2. Organizer login page supports approval-link prefill for email continuity.
3. Admin approval safeguard now shows an explicit grant/no-grant badge and updates live with checkbox state.
