# Resources Analytics Baseline (Story 4.3)

Date: 2026-06-10
Status: Sprint 1 baseline
Owners: PM, DATA-ANALYTICS, FE-WEB, FE-MOBILE

## Document Authority

- This file owns event contract baseline, panel definitions, and data-quality gates.
- It does not own sprint gate state or story acceptance criteria.
- Sprint gate status is tracked in `resources-improvement-two-sprint-plan.md` and `../implementation-artifacts/resources-sprint-execution-board.md`.

## 1. Objective

Establish a baseline event contract and dashboard slices for Sprint 1 resources improvements:

- persona quick-start modules
- intent chips and smart essentials
- trust/freshness cues

## 2. Event Dictionary

| Event Name                            | Trigger                                             | Required Properties                                  |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| resources_hub_view                    | Resources hub visible                               | city, persona (nullable), intent (nullable), variant |
| resources_experiment_variant_assigned | Variant assigned for resources module               | city, variant, module                                |
| resources_persona_selected            | Persona chip clicked                                | city, persona                                        |
| resources_intent_chip_selected        | Intent chip clicked                                 | city, intent                                         |
| resources_essentials_click            | Essential/journey CTA clicked                       | city, resource_slug/resource_id, resource_type       |
| resources_first_meaningful_action     | First meaningful resource action in session         | city, source_event                                   |
| resources_trust_badge_impression      | Trust/freshness badge rendered on resources surface | city, surface                                        |
| resources_stale_item_opened           | User opened stale/needs-review resource             | city, resource_id/resource_slug, resource_type       |
| resources_to_related_click            | Related community/event clicked (Sprint 2+)         | city, target_type, target_id                         |

## 3. Source Mapping

Web:

- Event catalog: apps/web/src/lib/analytics/events.ts
- Hub emits: apps/web/src/app/[city]/resources/ResourcesHubTracking.tsx
- Hub UI surfaces: apps/web/src/app/[city]/resources/page.tsx

Mobile:

- Event catalog: apps/mobile/lib/analytics/events.ts
- Emit API: apps/mobile/lib/analytics/track.expo.ts
- Hub emits: apps/mobile/app/resources/index.tsx
- Journey emits stale opens: apps/mobile/app/resources/journey.tsx

## 4. Baseline Dashboard Panels

1. Activation funnel

- resources_hub_view
- resources_persona_selected OR resources_intent_chip_selected
- resources_first_meaningful_action

2. Essentials effectiveness

- resources_essentials_click by city/persona/intent
- CTR from hub_view to essentials_click

3. Trust/freshness health

- resources_trust_badge_impression volume
- resources_stale_item_opened rate by city/resource_type

4. Variant monitoring

- resources_experiment_variant_assigned volume split by variant
- first_meaningful_action conversion by variant

## 5. Data Quality Gates

- Required dimensions completeness:
  - city >= 98%
  - variant >= 98% for flagged modules
  - persona/intent >= 95% when selection flows are used
- Event dedupe:
  - no duplicate hub view bursts per render cycle
- Schema guard:
  - unknown fields should be ignored, not fail ingestion

## 6. Query Skeletons

1. Hub to action conversion by city:

- numerator: distinct sessions with resources_first_meaningful_action
- denominator: distinct sessions with resources_hub_view

2. Persona conversion uplift:

- compare sessions with resources_persona_selected vs no persona selection

3. Stale exposure risk:

- stale_open_rate = resources_stale_item_opened / resources_first_meaningful_action

## 7. Notes

- All analytics must remain non-blocking to UX.
- Keep event names mirrored across web and mobile.
- This baseline intentionally avoids adding new storage dependencies in Sprint 1.
