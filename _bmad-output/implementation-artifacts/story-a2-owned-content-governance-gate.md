# Story A2: Owned-Content Governance Gate

Status: See resources-trust-freshness-ops-execution-board.md
Track: Resources Trust, Freshness, and Ops
Priority: P1
Wave Target: Wave 1
Owner: Product + OPS + BE-PLATFORM

## Canonical References

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`

## Story Intent

Ensure owned resource creation is policy-driven and auditable rather than ad hoc.

## Acceptance Criteria

1. Owned-content path requires rationale before save.
2. Required fields capture curation insufficiency and risk/confusion/frequency class.
3. Alternative-source consideration is captured.
4. Governance metadata is auditable after save.
5. Non-owned curated entries are not blocked by irrelevant governance fields.

## QA Gates

- Admin workflow validation passes.
- Governance data persists and can be inspected.
- Validation copy is clear.

## Engineering Path Focus

- Admin actions: `apps/web/src/app/admin/(dashboard)/data/actions.ts`
- Admin form: `apps/web/src/components/admin/ResourceForm.tsx`

## Definition of Done

- Acceptance criteria met.
- Governance rubric signed off by Product/Ops.
- Ready for lifecycle automation follow-on.
