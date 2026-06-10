# Story 4.3: Experimentation and Dashboard Baseline

Status: In Progress
Epic: Measurement and Quality
Priority: P0
Sprint Target: Sprint 1
Owner: Product + Data/Analytics + Web + Mobile

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX outcome validation flow: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`
- Event dictionary and panel spec: `../planning-artifacts/resources-analytics-baseline.md`

## Implementation Update (2026-06-10)

Completed:

- Core resources analytics event set added to web/mobile event catalogs.
- Event emitters wired into resources hub and key interactions.
- Baseline analytics dictionary and dashboard panel spec documented.
- Web and mobile typechecks passing.
- Added journey next-action/resume/reset/step-completion event coverage on web + mobile.
- Added CTA impression/click/variant coverage and track-route interaction/PostHog mappings for new events.

Deferred:

- Live dashboard implementation in analytics tool is pending Data/Analytics execution.
- Event completeness/null-rate validation report is pending post-deploy traffic.

Blockers:

- None.

Acceptance Gate Snapshot:

- AC1: done
- AC2: in progress (dimensions present in contract; completeness validation pending live data)
- AC3: in progress (dashboard spec complete; dashboard build pending)
- AC4: in progress (quality checks defined; execution pending)
- AC5: done (variant assignment events implemented and queryable once ingested)

## Acceptance Criteria

1. Core event set is defined and implemented in web and mobile analytics catalogs.
2. Events include required dimensions (city, persona, intent, lifecycle stage, variant, entity ids where applicable).
3. Dashboard contains baseline views for activation, progression, conversion, and 7-day return proxy.
4. Event quality checks (schema validity, null-rate thresholds) are documented and passing.
5. Experiment variant assignment is queryable in analytics data.

## Telemetry

- resources_hub_view
- resources_persona_selected
- resources_intent_chip_selected
- resources_essentials_click
- resources_trust_badge_impression
- resources_first_meaningful_action
- resources_to_related_click
- journey_view
- journey_step_completed
- resources_experiment_variant_assigned

## QA Gates

- Event names conform to naming convention and are deduplicated.
- Required dimensions are populated above agreed completeness threshold.
- Web/mobile parity matrix is documented and validated.
- Dashboard panels reflect live test traffic correctly.
- Analytics failures remain non-blocking for user flows.

## Engineering Subtasks by Path

- Web event catalog: add event constants and typing in `apps/web/src/lib/analytics/events.ts`.
- Web emitters: instrument resources and journey screens at `apps/web/src/app/[city]/resources/page.tsx` and `apps/web/src/app/[city]/resources/journey/page.tsx`.
- Mobile event catalog: add mirrored constants in `apps/mobile/lib/analytics/events.ts`.
- Mobile emitters: instrument `apps/mobile/app/resources/index.tsx` and `apps/mobile/app/resources/journey.tsx`.
- Data contract docs: add event dictionary and dashboard query notes in planning artifacts.

## Ownership and Estimate

- Owner tags: PM, FE-WEB, FE-MOBILE, DATA-ANALYTICS, QA
- Story points: 3

## Definition of Done

- Acceptance criteria met.
- Baseline dashboard is available to product and engineering.
- Event dictionary published with ownership and query examples.
- Sprint 1 rollout can be evaluated from analytics within 24h of exposure.
