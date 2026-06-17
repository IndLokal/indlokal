# Story 1.3: Low-Noise Trust and Freshness Layer

Status: See resources-sprint-execution-board.md
Epic: Journey Shell and Orientation
Priority: P1
Sprint Target: Sprint 2 (hardening)
Owner: Product + Design + Web + Mobile

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX trust/freshness model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Provide trust and freshness confidence signals with minimal visual noise so users can decide faster without card clutter.

## Implementation Snapshot (2026-06-10)

Completed:

- Trust/freshness badges are implemented on web and mobile resources/journey cards.
- Freshness fields are exposed for stale rendering behavior.
- Stale open telemetry is implemented.

Pending hardening:

- Accessibility evidence and design sign-off artifacts.

## Acceptance Criteria

1. Cards display one trust indicator and one freshness line only.
2. `Needs review` items are differentiated without dominating primary actions.
3. Freshness/trust copy is understandable on web and mobile.
4. Accessibility checks pass (contrast, labels, non-color-only meaning).
5. Trust/freshness interaction telemetry is queryable.

## Telemetry (Required)

- resources_trust_indicator_impression
- resources_freshness_badge_impression
- resources_stale_item_opened

## QA Gates

- Badge values and stale labeling are accurate for test fixtures.
- No card overflow/truncation regressions on smaller screens.
- Accessibility report artifacts attached to QA checklist.
- Pilot cohort confirms confidence signals do not reduce action rate.

## Engineering Path Focus

- Web: `apps/web/src/app/[city]/resources/page.tsx`, `apps/web/src/app/[city]/resources/journey/page.tsx`
- Mobile: `apps/mobile/app/resources/index.tsx`, `apps/mobile/app/resources/journey.tsx`
- Data mapping: `apps/web/src/modules/resources/resolver.ts`, `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`
- Events: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Definition of Done

- Acceptance criteria met and hardening items closed.
- Feature-flag rollout approved for expanded cohort.
- Included in Sprint 2 quality review.
