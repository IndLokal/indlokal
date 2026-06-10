# Story 2.3: Resume-First Return State

Status: Ready for Review
Epic: Progression and Resume
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Web + Mobile + API

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX resume/continue flow: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Ensure returning users resume in-progress journey context instead of re-entering cold discovery.

## Implementation Snapshot (2026-06-10)

- Added resume-first prompts on web resources hub and mobile resources/journey surfaces when progress exists.
- Unified resume persistence key (`resource_journey:v1:{citySlug}`) and added deterministic reset behavior in both clients.
- Added resume prompt/click/reset telemetry events and wired them into analytics catalogs and tracking API mapping.
- Rollout is feature-flag safe via `FEATURE_RESOURCES_RESUME` and `EXPO_PUBLIC_FEATURE_RESOURCES_RESUME`.

## Acceptance Criteria

1. Completion/progress state persists by user and city context.
2. Resume module appears when meaningful progress exists.
3. Resume links continue the active step or saved in-progress path.
4. Reset behavior is available and deterministic.
5. Resume/completion/reset telemetry is queryable.

## Telemetry (Required)

- journey_step_completed
- journey_resume_prompt_shown
- journey_resume_clicked
- journey_progress_reset

## QA Gates

- Progress persists across app/page reopen cycles.
- New users do not see false resume prompts.
- Reset clears progress with immediate UI consistency.
- Resume improves continuation behavior in pilot cohort.

## Engineering Path Focus

- Journey API/state: `apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts`
- Web journey UI: `apps/web/src/app/[city]/resources/journey/page.tsx`
- Mobile journey UI: `apps/mobile/app/resources/journey.tsx`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met behind feature flag.
- QA gates passed for resume and reset paths.
- Resume metrics included in Sprint 1 review pack.
