# Story B1: Freshness Lifecycle Automation

Status: See resources-trust-freshness-ops-execution-board.md
Track: Resources Trust, Freshness, and Ops
Priority: P1
Wave Target: Wave 2
Owner: BE-PLATFORM + FE-WEB

## Canonical References

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`

## Story Intent

Turn stale labeling into enforceable lifecycle behavior tied to review cadence.

## Acceptance Criteria

1. TTL breach is computed from `lastReviewedAt + reviewCadenceDays`.
2. Lifecycle rules distinguish in-TTL, stale/demoted, and prolonged-stale states.
3. Journey-critical placements demote stale rows correctly.
4. Prolonged stale rows can be hidden/archived under explicit guardrails.
5. Lifecycle changes are auditable.

## QA Gates

- TTL computation tested on representative fixtures.
- Ranking/order effects validated.
- Guardrails prevent accidental burial of critical resources.

## Engineering Path Focus

- Lifecycle logic: `apps/web/src/modules/resources/resolver.ts`
- Resource model fields: `apps/web/prisma/schema.prisma`
- Resource surfaces/order validation: web resource pages

## Definition of Done

- Acceptance criteria met.
- Lifecycle states stable enough to feed queue creation.
