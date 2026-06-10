# Story B2: Re-verification Queue and SLA

Status: See resources-trust-freshness-ops-execution-board.md
Track: Resources Trust, Freshness, and Ops
Priority: P1
Wave Target: Wave 2
Owner: OPS + BE-PLATFORM + FE-WEB

## Canonical References

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`

## Story Intent

Give Ops an actionable queue for stale and high-risk resource review.

## Acceptance Criteria

1. Eligible stale resources create queue rows.
2. Priority order reflects risk, traffic, staleness duration, and journey criticality.
3. Queue supports assignment and SLA fields.
4. Resolution actions update the underlying resource state.
5. Overdue backlog is visible.

## QA Gates

- Queue rows create deterministically.
- Resolution flow is auditable.
- SLA and overdue logic is accurate.

## Engineering Path Focus

- Admin queue surfaces
- Queue model/service layer
- Resource state update integration

## Definition of Done

- Acceptance criteria met.
- Ops can run stale review from queue, not from passive badge scanning.
