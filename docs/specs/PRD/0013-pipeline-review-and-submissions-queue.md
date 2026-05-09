# PRD-0013: Pipeline review & submissions queue scoping

- **Status:** Shipped
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0013, AI_AGENT_PRODUCT.md, AI_AGENT_ARCHITECTURE.md

## 1. Problem

The admin "Submissions" queue had become unusable:

1. **AI pipeline imports** sat next to **user submissions**, drowning the
   things a human actually had to act on.
2. **Editorial directory rows** (curated, planted by `prisma/directory.ts`)
   were also showing up because they were created with
   `status = UNVERIFIED`.
3. When an admin **approved** an AI-extracted community from the pipeline,
   the result was inserted with `UNVERIFIED` status, which immediately
   sent it back into the same submissions queue for a second round of
   approval. Effectively: every approval generated its own backlog item.

## 2. Users & JTBD

- **Platform admin** — wants the submissions queue to mean "things
  humans submitted that need a human decision", and nothing else.
- **Platform admin** — when approving a pipeline candidate, wants the
  community to be live, not re-queued.

## 3. Success Metrics

- Submissions queue length tracks 1:1 with the count of pending
  user-submitted communities.
- Zero "approve → still pending" loops.
- Zero directory-seeded communities surface in the queue after the next
  bootstrap.

## 4. Scope

- Scope the submissions list query to
  `{ status: 'UNVERIFIED', source: 'COMMUNITY_SUBMITTED' }`.
- Default `prisma/directory.ts` community status to `'ACTIVE'` (curated
  rows are trusted on insert).
- Pipeline approval (`approvePipelineItemRecord`):
  - Admin-approved → community status `'ACTIVE'`.
  - Auto-approved (high-confidence path) → `'UNVERIFIED'` (so a human can
    still spot-check via the existing data console).
- One-shot SQL backfill to flip historical `ADMIN_SEED` / `IMPORTED`
  rows from `UNVERIFIED` to `ACTIVE`.

## 5. Out of Scope

- Reworking the AI confidence threshold itself (separate AI agent spec).
- Pipeline **rejection** workflow — already exists, unchanged.
- Mobile submission flow (PRD-0009).

## 6. User Stories

- As an admin opening "Submissions" I want to only see user-submitted
  communities awaiting review, not pipeline imports or seed rows.
- As an admin approving a pipeline candidate I want the community to be
  immediately live on the city page.
- As a curator running directory bootstrap on a fresh database I want my
  rows to be live without an extra approval pass.

## 7. Acceptance Criteria

```
Given the submissions page is opened
 When the data loads
 Then only communities with source=COMMUNITY_SUBMITTED and
      status=UNVERIFIED are listed.

Given an admin approves a pipeline-sourced extraction
 When approvePipelineItemRecord runs with adminApproved=true
 Then the resulting community is created/updated with status=ACTIVE.

Given an extraction is auto-approved by high confidence
 When approvePipelineItemRecord runs with adminApproved=false
 Then the resulting community is created with status=UNVERIFIED.

Given prisma/directory.ts is run on an empty city
 When seeded communities are inserted
 Then their status is ACTIVE.
```

## 8. Risks & Open Questions

- **Risk:** lowering the bar on pipeline approval moves more responsibility
  onto the AI confidence model. Mitigated: the data console (PRD-0012)
  lets an admin remove a bad row in seconds.
- **Open:** add a "Pipeline" tab in admin so auto-approved
  `UNVERIFIED` rows are visible without being mixed into the user
  submissions queue.
