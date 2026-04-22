# PRD-0009: Submit event / community (camera + gallery)

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead, Trust & Safety

## 1. Problem

Mirror web `/submit` so users can contribute events and communities on the go, with photos taken in the moment.

## 2. Users & JTBD

- Organizer / community member — "Submit our Diwali event in 60 seconds with a flyer photo."

## 3. Success Metrics

- ≥ 30 % of new submissions originate from the app.
- Submission completion ≥ 70 % once started.
- Median time-to-submit < 90 s.

## 4. Scope

- Submission types: **Event**, **Community**, **Suggest a community**.
- Camera + gallery picker for hero/flyer image; cropping.
- Required fields mirror web; smart defaults (city = current).
- Submissions enter `PipelineItem` with `sourceType = USER_SUBMITTED` (see `PipelineSourceType` in `prisma/schema.prisma`).
- Confirmation screen with status + share.
- Notifications on status change (topic=`ORGANIZER_SUBMISSION`).

## 5. Out of Scope

- OCR auto-extraction from flyer (Phase 2 — `docs/AI_AGENT_PRODUCT.md`).
- Bulk import.

## 6. User Stories

- As an organizer I take a photo of the flyer, fill 4 fields, and submit.
- As a submitter I get a push when my submission is approved.

## 7. Acceptance Criteria

```
Given a user with no network attempts to submit
When they tap Submit
Then the form is queued locally and auto-retries when network returns; success notif fires
```

## 8. UX

Multi-step form (Type → Basics → Image → Review). Image upload progress; lossy compression to ≤ 2 MB.

## 9. Risks & Open Questions

- CSAM / abuse vectors — image hash check on backend; report flow live from day 1.
