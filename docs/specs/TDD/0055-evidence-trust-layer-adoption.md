# TDD-0055: Evidence & Trust Layer adoption

- **Status:** Approved
- **Linked PRD:** PRD-0055
- **Owner:** Platform / Discovery

## 1. Architecture overview

The classification engine ([`apps/web/src/lib/source-policy.ts`](../../../apps/web/src/lib/source-policy.ts))
stays the single source of truth. This work only **wires its output** into four surfaces and adds one
thin, pure presentation helper. No classification logic changes.

```
source-policy.summarizeEvidence(urls)  ──►  intake (web action + mobile service)  ──► metadata.sourceEvidence (persisted)
                                       ├─►  admin submissions queue (reads metadata)
                                       ├─►  admin claims queue (computes over claim links)
                                       └─►  community-trust.getCommunityEvidenceBadge(urls) ──► CommunityCard + detail page (read-time)
```

Components touched:

- `apps/web/src/lib/community-trust.ts` — **new** pure helper (badge mapping).
- `apps/web/src/app/submit/actions.ts` — `submitCommunity`: classify channels, persist summary.
- `apps/web/src/modules/submit/service.ts` — `createCommunitySubmission`: classify channels into
  `PipelineItem.metadata` for parity.
- `apps/web/src/app/admin/(dashboard)/submissions/page.tsx` — evidence chip from `metadata`.
- `apps/web/src/app/admin/(dashboard)/claims/page.tsx` — evidence chip from claim links.
- `apps/web/src/modules/community/queries.ts` + `types.ts` — derive `evidenceBadge` on list items;
  detail already loads channels.
- `apps/web/src/components/CommunityCard.tsx` + community detail page — render badge.

### 1.1 Coherence architecture amendment (2026-06)

Trust display logic is centralized in `lib/community-trust.ts` as a contract consumed by all
surfaces. This avoids policy drift from duplicated conditional rendering.

Added/expanded helper responsibilities:

- `getEvidenceQualityDisplay(quality)`
- `resolveEvidenceReadout({ storedEvidence, sourceUrls })`
- `getClaimProofReadout(evidenceUrls)`
- `getCommunityCardTrustMarkers({ claimState, status, isTrending, hasStrongSource })`

Consumption contract:

- Admin communities page uses `resolveEvidenceReadout` for metadata + fallback summary.
- Admin submissions page uses `resolveEvidenceReadout` for intake metadata chips.
- Admin claims page uses `getClaimProofReadout` for ownership-proof chips.
- Community cards use `getCommunityCardTrustMarkers` for coherent priority.

## 2. Data model changes

**None.** No Prisma migration. Additive JSON only:

- `Community.metadata.sourceEvidence = { quality, score, strongestTier, strongestLabel, requiresReview, assessedAt }`
- `Community.metadata.needsReview: boolean` (mirrors policy `requiresReview` at intake)
- `PipelineItem.metadata.sourceEvidence` (same shape) for mobile parity.

Public badges derive at **read time** from live access-channel URLs, so legacy rows need no backfill.

## 3. API surface

No new endpoint and no new Zod contract. The `submitCommunity` server action and the existing
`POST /api/v1/submissions/community` (→ `createCommunitySubmission`) inputs are unchanged; only the
persisted metadata is enriched.

| Method | Path                            | Auth                | Request   | Response  |
| ------ | ------------------------------- | ------------------- | --------- | --------- |
| (n/a)  | server action `submitCommunity` | none (rate-limited) | unchanged | unchanged |
| POST   | `/api/v1/submissions/community` | bearer              | unchanged | unchanged |

## 4. Mobile screens & navigation

None in this spec. Mobile submission still creates a `PipelineItem`; the only change is enriched
`metadata.sourceEvidence` visible to admins. Mobile UI badges are deferred (PRD §5).

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None — additive, read-only presentation + metadata enrichment with no behavioral gate. Backout is a
straight revert (see §11).

## 7. Observability

- `metadata.sourceEvidence.quality` makes intake grading inspectable in the admin queue and DB.
- No new analytics events required; existing `COMMUNITY_SUBMITTED` / `CLAIM_SUBMITTED` events are
  unchanged. (A future `evidence_quality` property on those events is a candidate, not in scope.)

## 8. Failure modes & fallbacks

- `summarizeEvidence` is pure and never throws on malformed URLs (it normalizes/blocks internally).
  If a URL is unusable it contributes `insufficient`, never an exception.
- Intake classification is wrapped so a classification miss never blocks the submission write
  (best-effort enrichment; the community is still created).
- Public badge: if no channels or insufficient evidence → render nothing (graceful absence).

## 9. Test plan

- **Unit:** `community-trust` badge mapping (strong → strong_source, weak → source_supported,
  none → null), evidence quality copy mapping, stored-vs-live evidence resolution, claim-proof
  readout mapping, and card marker priority ordering.
- **Integration:** submission persists `metadata.sourceEvidence` with the expected `quality` for a
  strong link vs a weak link (mock `@/lib/db` with `testDb`, mirror
  `modules/community/__tests__/queries.integration.test.ts`).
- **Contract / E2E:** none new.

## 10. Coherence invariants

1. Ownership (`CLAIMED`) remains the highest-priority trust marker in capped card chips.
2. Evidence copy/tone is sourced from one mapping function across all admin surfaces.
3. Missing legacy metadata never breaks evidence display; helper fallback to live summary is required.

## 11. Rollout plan

Direct ship (no flag). Additive metadata + presentation. Verify in staging that the admin queues show
chips and the directory shows the badge.

## 12. Backout plan

Revert the surface edits + delete `lib/community-trust.ts`. Persisted `metadata.sourceEvidence` is
inert extra JSON and can remain; nothing reads it after a revert.
