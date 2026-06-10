# Story 3.2: Action-First Resource Detail CTA

Status: Ready for Review
Epic: Information to Real-World Action
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Design + Web + Mobile

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX action model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Turn resource detail into a decision surface with one clear primary action to improve first meaningful action rate.

## Implementation Snapshot (2026-06-10)

- Implemented action-first hierarchy on journey/resume modules with one primary Continue CTA and explicit secondary actions.
- Added CTA impression/click/variant instrumentation on web + mobile resources surfaces.
- Kept hierarchy rollout gated (`FEATURE_RESOURCES_CTA`, `EXPO_PUBLIC_FEATURE_RESOURCES_CTA`) for additive low-risk exposure.
- Existing route contracts and deep links remain unchanged.

## Acceptance Criteria

1. Each resource detail context presents one primary CTA and clearly secondary alternatives.
2. CTA labels align to user stage and intent context.
3. CTA ordering is consistent on web and mobile.
4. Variant hook exists for controlled CTA ordering tests.
5. CTA interactions are trackable by position and variant.

## Telemetry (Required)

- resource_cta_impression
- resource_cta_click
- resource_cta_variant_assigned

## QA Gates

- No conflicting or duplicated primary CTA states.
- Variant assignment stable for session/cohort.
- CTA copy remains understandable on mobile and desktop.
- Uplift trend in first meaningful action for detail sessions.

## Engineering Path Focus

- Web surfaces: `apps/web/src/app/[city]/resources/page.tsx`, `apps/web/src/app/[city]/resources/journey/page.tsx`
- Mobile surfaces: `apps/mobile/app/resources/index.tsx`, `apps/mobile/app/resources/journey.tsx`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met behind feature flag.
- QA gates passed for at least one pilot city/user-stage set.
- Included in Sprint 1 conversion review.
