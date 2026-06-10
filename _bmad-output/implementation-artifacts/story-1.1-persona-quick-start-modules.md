# Story 1.1: Start Here Orientation Module

Status: See resources-sprint-execution-board.md
Epic: Journey Shell and Orientation
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Web + Mobile

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX module/flow model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Introduce a clear Start Here entry that gives users immediate orientation and a single primary path without breaking existing resources routes.

## Implementation Snapshot (2026-06-10)

Completed:

- Start Here persona entry implemented on web and mobile behind flags.
- Selection updates recommendation context in-session.
- Interaction instrumentation implemented and typechecks passing.

Deferred:

- API-first persona query model remains deferred to reduce Sprint 1 risk.

## Acceptance Criteria

1. Start Here is first visible decision module on resources entry.
2. Persona/stage choice updates recommendations in the same session.
3. Default view remains understandable without opening advanced filters.
4. Existing browse/discovery path remains accessible.
5. Core events emit and are queryable post-ingestion.

## Telemetry (Required)

- resources_hub_viewed
- resources_variant_exposed
- resources_persona_selected
- resources_first_meaningful_action

## QA Gates

- Orientation comprehension: users can identify next step within first screen.
- No dead-end fallback for sparse tagged data.
- Mobile/web parity for module behavior and labels.
- Route stability preserved for city resources URLs.

## Engineering Path Focus

- Web: `apps/web/src/app/[city]/resources/page.tsx`
- Mobile: `apps/mobile/app/resources/index.tsx`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met under feature flag.
- QA gates passed for pilot city.
- Events visible in baseline funnel checks.
