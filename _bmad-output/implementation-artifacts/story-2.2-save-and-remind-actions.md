# Story 2.2: Save and Remind Actions

Status: See resources-sprint-execution-board.md
Epic: Progression and Resume
Priority: P1
Sprint Target: Sprint 2
Owner: Product + Web + Mobile + Backend

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX continue/resume model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Add lightweight save/remind loops where they directly support journey continuation and return behavior.

## Acceptance Criteria

1. User can save/unsave a resource from key surfaces.
2. User can set and clear a reminder using preset options.
3. Saved/reminder state persists and is reflected in UI.
4. Actions are idempotent and resilient on retries.
5. Save/reminder events are tracked.

## Telemetry (Required)

- resource_saved
- resource_unsaved
- resource_reminder_set
- resource_reminder_cleared

## QA Gates

- Save/remind works for authenticated user states.
- Correct error messaging on failure.
- State survives app refresh/session restart.
- No duplicate reminder entries from repeated actions.

## Engineering Subtasks by Path

- Web save/remind UI: add action controls in `apps/web/src/app/[city]/resources/page.tsx` and `apps/web/src/app/[city]/resources/journey/page.tsx`.
- Mobile save/remind UI: add action controls in `apps/mobile/app/resources/index.tsx` and `apps/mobile/app/resources/journey.tsx`.
- API support: add/extend endpoints under `apps/web/src/app/api/v1/cities/[slug]/resources/` for save/remind operations.
- Persistence logic: implement idempotent save/remind handling in backend module layer.
- Analytics: instrument actions in `apps/web/src/lib/analytics/events.ts` and `apps/mobile/lib/analytics/events.ts`.

## Definition of Done

- Acceptance criteria met.
- MVP reminder behavior approved by product.
- Monitored rollout with rollback toggle.
