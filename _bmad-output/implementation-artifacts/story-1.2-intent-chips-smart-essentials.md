# Story 1.2: Focused Shortlist and Smart Essentials

Status: Ready for Review
Epic: Journey Shell and Orientation
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Web + Mobile

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX interaction model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Reduce first-screen clutter by prioritizing a small, high-confidence shortlist and essentials that never dead-end.

## Implementation Snapshot (2026-06-10)

Completed:

- Intent-based shortlist behavior on web/mobile behind flags.
- Essentials fallback behavior implemented.
- Interaction events added on both platforms.

Deferred:

- API-first filter source-of-truth deferred; current logic composes on resolved payload.

## Acceptance Criteria

1. Initial recommendation set is constrained and clearly prioritized.
2. Advanced filtering is available via compact interaction (drawer/bottom sheet), not dominant by default.
3. Essentials always provide useful fallback actions.
4. Existing route behavior and deep links remain stable.
5. Shortlist and essentials telemetry is queryable.

## Telemetry (Required)

- resources_intent_chip_selected
- resources_essentials_rendered
- resources_essentials_click
- resources_first_meaningful_action

## QA Gates

- Rapid filter toggling does not create stale or conflicting view state.
- Sparse-data scenarios always render fallback actions.
- Desktop and mobile present equivalent decision quality.
- No route or count regressions for pilot city path.

## Engineering Path Focus

- Web: `apps/web/src/app/[city]/resources/page.tsx`
- Mobile: `apps/mobile/app/resources/index.tsx`
- Resolver/API touchpoints: `apps/web/src/modules/resources/resolver.ts`, `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met under feature flag.
- QA gates passed with pilot scenarios.
- Funnel signals available for Sprint 1 go/no-go.
