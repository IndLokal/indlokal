# Story C1: Journey-Gap to Supply Ops Loop

Status: See resources-trust-freshness-ops-execution-board.md
Track: Resources Trust, Freshness, and Ops
Priority: P2
Wave Target: Wave 3
Owner: OPS + DATA-ANALYTICS + PM

## Canonical References

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`

## Story Intent

Turn journey coverage gaps into a real weekly operational backlog with ownership and SLAs.

## Acceptance Criteria

1. Coverage report generates backlog rows by city/persona/stage.
2. Priority logic is visible and understandable.
3. Owner and SLA can be assigned.
4. Backlog can be reviewed weekly by Ops/Product.

## QA Gates

- Backlog rows reflect real coverage gaps.
- Priority ordering matches agreed rubric.
- No duplicate noisy backlog generation.

## Engineering Path Focus

- Journey coverage: `apps/web/src/modules/journeys/coverage.ts`
- Ops backlog/readout layer

## Definition of Done

- Acceptance criteria met.
- READY/THIN reporting feeds owned operational work.
