# PRD-0055: Evidence & Trust Layer adoption (badges, intake classification, claim pre-flag)

- **Status:** Approved
- **Owner:** Platform / Discovery
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0055, [`docs/SOURCE_AND_EVIDENCE_POLICY.md`](../../SOURCE_AND_EVIDENCE_POLICY.md), PRD/TDD-0032 (channels & claim evidence), PRD/TDD-0031 (claim lifecycle), PRD/TDD-0013 (submissions queue)

## 1. Problem

IndLokal already has a deterministic **source & evidence policy**
([`apps/web/src/lib/source-policy.ts`](../../../apps/web/src/lib/source-policy.ts)) that grades
any URL into an evidence tier and derives a trust readout (`summarizeEvidence`). Today that engine
is only consumed by ingestion-side code (directory seed, resources seed, pipeline pinned-URL
gating). The same signal is **not surfaced** where humans actually make trust decisions:

- A **community submitter** drops channel links, but nothing classifies them at intake, so the
  admin queue treats a `handelsregister.de` registry link and a throwaway `linktr.ee` identically.
- A **claimant** uploads proof links, but reviewers see raw links with no read on whether the proof
  is strong enough to back ownership.
- A **member browsing the directory** sees `Provisional` / `Claimed by organizer` chips but gets no
  honest read on whether a listing is backed by a strong public source.

The policy document ([`docs/SOURCE_AND_EVIDENCE_POLICY.md`](../../SOURCE_AND_EVIDENCE_POLICY.md) §12)
explicitly calls these out as the adoption gaps. This spec closes them.

### 1.1 Coherence Amendment (2026-06)

Initial adoption shipped, but trust presentation logic fragmented across surfaces (cards, admin
claims, admin submissions, admin communities). Equivalent decisions were implemented with separate
local conditionals, creating copy drift and priority drift.

This amendment upgrades the target from "surface evidence" to a **single trust contract** that all
surfaces consume.

## 2. Users & JTBD

- **Member / visitor** — _"When I scan the directory, I want to know which listings are backed by a
  real, strong source so I can trust where I'm spending time."_
- **Reviewing admin** — _"When I triage submissions and claims, I want the evidence pre-graded so I
  approve strong proof fast and scrutinize weak proof."_
- **Submitter / claimant** — _"When I add links, I want the platform to recognize strong proof so my
  listing/claim moves faster."_

## 3. Success Metrics

- Every new `COMMUNITY_SUBMITTED` community persists `metadata.sourceEvidence` (quality + score).
- Admin submission & claim queues render an evidence-quality chip for 100% of rows that carry links.
- Public directory surfaces an honest evidence badge driven by `summarizeEvidence`, with **no new
  PII** exposed (badge derives only from public source URLs, never submitter contact data).
- No schema migration required (additive, metadata-only + read-time derivation).

## 4. Scope

- Classify channel evidence at **submission intake** (web server action + mobile pipeline service)
  and persist a compact `sourceEvidence` summary in `Community.metadata` / `PipelineItem.metadata`.
- **Pre-flag claim proofs** in the admin claims queue: compute `canSupportClaimVerification` +
  `summarizeEvidence` over the claim's evidence links and render a quality chip.
- **Admin submissions queue** evidence chip from the persisted `sourceEvidence`.
- **Public evidence badge** on `CommunityCard` and the community detail page, derived from access
  channels via `summarizeEvidence` (positive "Strong source" on cards; full read on detail).
- A small shared, pure helper (`lib/community-trust.ts`) that maps evidence → a display badge.

### 4.1 Unified Trust Contract (in scope)

- `lib/community-trust.ts` is the only policy-to-presentation mapping layer for:
  - evidence quality copy/tone mapping,
  - stored-vs-live evidence readout resolution,
  - claim-proof readout mapping,
  - community card trust-marker priority.
- Admin claims, submissions, and communities must consume this contract directly, not local
  conditional copies.
- Public card marker priority must keep ownership (`CLAIMED`) as the strongest visible trust signal.

## 5. Out of Scope

- Changing the policy/classification logic itself (tiers, confidence, German markers) — frozen.
- Auto-approving submissions or auto-verifying claims (human review stays the gate).
- A `Community.metadata` Prisma type migration or any DB migration.
- Mobile (Expo) UI badges — server classification only; mobile UI parity is deferred.
- Re-grading existing rows via backfill (read-time derivation covers existing rows for badges).

## 6. User Stories

- As a member, I want a "Strong source" badge on cards whose listing is backed by strong evidence.
- As an admin, I want submissions and claims pre-graded (strong / source-supported / insufficient).
- As a submitter, I want strong channel links recognized so reviewers fast-track my listing.

## 7. Acceptance Criteria (Gherkin)

```
Given a community is submitted with a handelsregister.de channel link
When the submission is persisted
Then metadata.sourceEvidence.quality is "verified_candidate" and needsReview reflects the policy

Given a community is submitted with only a linktr.ee channel link
When the submission is persisted
Then metadata.sourceEvidence.quality is "source_supported" and needsReview is true

Given an admin opens the claims queue for a pending claim with a strong proof link
When the page renders
Then an evidence chip shows the proof can back claim verification

Given a community whose access channels include a strong public source
When a member views its card
Then a "Strong source" badge is shown alongside existing status chips

Given a community with only weak public sources
When a member views its detail page
Then a "Source-supported" line is shown (and no badge over-claims verification)
```

## 8. UX

- **Card** ([`CommunityCard.tsx`](../../../apps/web/src/components/CommunityCard.tsx)): add a single
  positive chip "Strong source" (emerald/teal ring) only when evidence is strong. Weak/insufficient
  show nothing new (the existing `Provisional` chip already covers the unverified state) to avoid
  noise. Tooltip via `title` carries the policy reason.
- **Detail page header**: a small honest line — "Strong source" or "Source-supported" — with the
  policy `reviewReason` as helper text.
- **Admin submissions / claims**: a chip reading `Strong source` / `Source-supported` /
  `Insufficient evidence` with the reason on hover; claims additionally read "can back a claim".
- **Copy discipline**: the word "Verified" is reserved for the organization/claim axis. Evidence
  copy describes _source quality_ only ("Strong source" → "Source-supported" → "Insufficient
  evidence") and never asserts the org is verified. Empty/insufficient → no badge.
- **a11y**: chips are text + ring (not color-only); `title` provides the long reason.

### 8.1 Trust-Axis Copy Rules (amendment)

- **Ownership axis** (`claimState`) copy is separate from source quality and remains highest-priority
  trust signal on cards.
- **Evidence axis** (`summarizeEvidence`) copy never claims org verification; it only describes source
  strength.
- **Lifecycle/momentum axis** (`status`, pulse/trending) is supplementary and may be hidden when
  ownership/evidence already occupy the chip budget.

## 9. Risks & Open Questions

- **Over-claiming**: a strong source ≠ a verified org. Mitigated by copy ("Verified _source_") and by
  keeping it separate from the claim badge.
- **Card query cost**: badge needs channel URLs in the list query. Mitigated by selecting only
  `accessChannels.url` and computing the pure summary in the mapper (lists capped at 20).
- **Stale persisted summary**: intake persists a snapshot; public badge derives at read time from
  live channels, so edits stay accurate without backfill.
- **Open**: whether to later type `Community.metadata` and backfill `sourceEvidence` for legacy rows
  (deferred; not required because badges derive at read time).

## 10. Acceptance Criteria Addendum (coherence)

```
Given admin communities, submissions, and claims render evidence chips
When a quality label/tone mapping changes in the trust helper
Then all three surfaces reflect the same copy and tone without local logic edits

Given a community is CLAIMED and also has strong source + trending
When the card top markers render with a 2-chip cap
Then Claimed appears first and is never displaced by lower-priority markers

Given persisted metadata.sourceEvidence is absent or partial on legacy rows
When admin surfaces render evidence
Then they fall back to live summarizeEvidence output with coherent labels/reason
```
