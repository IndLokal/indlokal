# Story 4.2: Outdated Feedback Loop

Status: Draft
Epic: Measurement and Quality
Priority: P2
Sprint Target: Sprint 3+
Owner: Product + Backend + Admin/Ops

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX trust/escalation pattern: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Create a lightweight stale-report loop that feeds Ops triage and keeps content quality improving over time.

## Acceptance Criteria

1. User can submit outdated report from resource surface.
2. Report stores resource id, city/context, timestamp, and reason.
3. Admin/Ops can view, triage, and mark resolution states.
4. Duplicate reports for same issue are deduplicated or grouped.
5. Reporting and resolution events are tracked.

## Telemetry (Required)

- resource_outdated_report_submitted
- resource_outdated_report_grouped
- resource_outdated_report_resolved

## QA Gates

- Report submission is resilient and abuse-aware.
- Admin queue shows complete context for triage.
- Status transitions are auditable.
- Resolution metrics can be queried.

## Engineering Subtasks by Path

- Web report action: add outdated-report CTA on resources surfaces in `apps/web/src/app/[city]/resources/page.tsx` and related detail context.
- Mobile report action: add report affordance in `apps/mobile/app/resources/index.tsx` and/or `apps/mobile/app/resources/journey.tsx`.
- API endpoint: add submission and lifecycle endpoints under `apps/web/src/app/api/v1/cities/[slug]/resources/` or admin API namespace.
- Admin triage: integrate with admin data workflows under `apps/web/src/app/admin/(dashboard)/data/resources/`.
- Analytics: add report submit/resolve tracking in `apps/web/src/lib/analytics/events.ts` and `apps/mobile/lib/analytics/events.ts`.

## Definition of Done

- Acceptance criteria met.
- Ops runbook updated with triage SLAs.
- Initial rollout enabled for pilot cohort.
