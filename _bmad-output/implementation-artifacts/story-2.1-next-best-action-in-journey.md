# Story 2.1: Next Best Action in My Journey

Status: Ready for Review
Epic: Progression and Resume
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Web + Mobile + API

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX flow model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Make My Journey actionable by surfacing one primary next step that updates with user progress.

## Implementation Snapshot (2026-06-10)

- Added next-best-action modules on web and mobile journey surfaces with a single primary Continue CTA.
- Next action now recomputes from persisted checklist progress in-session after mark-complete actions.
- Added impression/click/completion analytics events and wired track-route mappings for queryability.
- Kept routing unchanged (`/[city]/resources`, `/[city]/resources/journey`, `/resources`, `/resources/journey`).

## Acceptance Criteria

1. My Journey surfaces one primary next action when actionable state exists.
2. Completion changes refresh the next action in-session.
3. The module deep-links directly to the target action.
4. Behavior remains consistent across web and mobile journey surfaces.
5. Impression/click/completion events are queryable.

## Telemetry (Required)

- journey_next_action_impression
- journey_next_action_click
- journey_next_action_completed

## QA Gates

- Representative newcomer scenarios resolve to sensible next steps.
- No dead-end state after step completion.
- Sparse-data fallback still proposes a useful action.
- Web/mobile output parity for same user state.

## Engineering Path Focus

- Decision logic: `apps/web/src/modules/resources/resolver.ts`
- Journey API: `apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts`
- Web UI: `apps/web/src/app/[city]/resources/journey/page.tsx`
- Mobile UI: `apps/mobile/app/resources/journey.tsx`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met behind feature flag.
- QA gates passed on at least two journey scenarios.
- Included in Sprint 1 go/no-go review.
