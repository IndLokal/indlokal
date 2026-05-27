# TDD-0033: Submission and claim PII notice baseline

- **Status:** Draft
- **Linked PRD:** PRD-0033
- **Owner:** Founders

## 1. Architecture overview

Target only required-email web flows that already persist metadata:

1. Submission flow
   - [apps/web/src/app/submit/SubmitForm.tsx](apps/web/src/app/submit/SubmitForm.tsx)
   - [apps/web/src/app/submit/actions.ts](apps/web/src/app/submit/actions.ts)
   - [apps/web/src/lib/validation.ts](apps/web/src/lib/validation.ts)
2. Claim flow
   - [apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx](apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx)
   - [apps/web/src/app/[city]/communities/[slug]/actions.ts](apps/web/src/app/[city]/communities/[slug]/actions.ts)
   - [apps/web/src/lib/validation.ts](apps/web/src/lib/validation.ts)

No changes to auth, cookies, or analytics stack in this spec.

## 2. Data model changes

No Prisma migration required.

Use existing JSON metadata fields:

- Submission: `Community.metadata.submitter.notice`
- Claim: `Community.metadata.claimRequest.notice`

Canonical shape:

```ts
{
  policyVersion: string, // e.g. "2026-05-v1"
  source: "submit_form" | "claim_form"
  recordedAt: string // ISO datetime
}
```

## 3. Validation and server behavior

### 3.1 Submission action

In [apps/web/src/app/submit/actions.ts](apps/web/src/app/submit/actions.ts):

- On success, include notice receipt in `metadata.submitter.notice`.

### 3.2 Claim action

In [apps/web/src/app/[city]/communities/[slug]/actions.ts](apps/web/src/app/[city]/communities/[slug]/actions.ts):

- On success, merge notice receipt into `metadata.claimRequest.notice`.

## 4. UI changes

### 4.1 Submit form

In [apps/web/src/app/submit/SubmitForm.tsx](apps/web/src/app/submit/SubmitForm.tsx):

- Add inline notice near submit action.
- Notice includes links to `/privacy` and `/terms`.

### 4.2 Claim form

In [apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx](apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx):

- Add same inline notice with legal links.

## 5. Constants and versioning

Use policy version string `2026-05-v1` consistently in submit and claim actions.

Future updates should change version string and keep previous values in historical rows.

## 6. Failure modes and fallback

- Existing older rows without notice object:
  - remain valid; no backfill needed.
- Policy version typo drift:
  - avoid by sourcing from one constant.

## 7. Observability

Minimal instrumentation only:

- Keep existing submit/claim analytics events unchanged in this phase.
- No new event names or properties required.

## 8. Test plan

Unit:

- metadata writer helper shape for notice receipt is stable.

Integration:

- Submit action writes notice receipt under `metadata.submitter.notice`.
- Claim action writes notice receipt under `metadata.claimRequest.notice`.

UI:

- Submit form renders privacy/terms notice links.
- Claim form renders privacy/terms notice links.

## 9. Rollout plan

1. Ship notice UI + metadata receipt writes.
2. Verify staging submissions/claims store notice object correctly.
3. Monitor first 7 days for submission conversion impact.

## 10. Backout plan

- Keep metadata readers tolerant (notice object optional).
- Keep inline legal notice text as default baseline.
