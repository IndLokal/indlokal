# IndLokal Resources Improvement PRD (One Pager)

Date: 2026-06-10
Owner: Product (John)
Status: Draft for execution

## Document Authority

- This file is the single source of truth for problem, goals, scope, and success metrics.
- Delivery sequencing and sprint gate status live in `resources-improvement-two-sprint-plan.md`.
- Story-level sequencing and ownership live in `../implementation-artifacts/resources-improvement-story-sequence.md`.

## 1. Problem

The Resources section is useful but still behaves like a directory in key moments. Users with urgent life-transition intent (move, visa, housing, health, tax) need a guided, city-aware next-step experience. Current experience has strong data quality and scope resolution, but limited need-first entry, limited cross-linking to communities/events, and insufficient retention loops.

## 2. Goal

Turn Resources into a need-first guidance layer that increases activation, cross-surface conversion, and repeat usage.

## 3. Objectives (90 days)

- Increase resource activation (landing to first meaningful click/open).
- Increase journey progression (users completing multiple essential steps).
- Increase cross-surface conversion (resource to community/event action).
- Improve trust signaling and freshness impact on ranking.

## 4. Target Users

- Newcomers (pre-arrival, first 30 days, first 90 days).
- Families, students, employees, founders.
- City-first discovery users in Germany metros.

## 5. Scope

### In Scope

- Need-first entry modules on Resources hub (persona and intent chips).
- Journey enhancement (next best action, progress continuity).
- Resource-to-community/event cross-links.
- Save/remind actions for lifecycle follow-through.
- Trust/freshness signals in UI and ranking influence.
- Instrumentation and experiment hooks.

### Out of Scope

- Full AI concierge rewrite.
- Major schema redesign.
- Non-Germany geography expansion.

## 6. Product Requirements

1. Need-first entry

- Add persona quick-start blocks: Student, Family, Employee, Founder, Newcomer.
- Add intent chips: Anmeldung, Housing, Health, Visa, Tax, Jobs.
- Show dynamic essential-steps module by city and lifecycle stage.

2. Journey progression

- Compute and surface next best action per user context.
- Persist and resume progress in web and mobile.
- Clarify completion and action outcomes per step.

3. Cross-surface loops

- Add related communities and upcoming events on resource detail surfaces.
- Add save and remind interactions from resource and journey contexts.

4. Trust and freshness

- Show verification/freshness metadata on cards and details.
- Apply freshness and trust boosts/penalties in result ordering.
- Add report-outdated feedback loop.

5. Analytics and experiments

- Instrument key funnel events and progression events.
- Support A/B experiments for entry modules and CTA hierarchy.

## 7. Success Metrics

Primary:

- +30% first meaningful resource action rate.
- +25% users with at least 2 journey steps completed.
- +20% resource to community/event click-through.
- +15% 7-day return among resources users.

Secondary:

- Reduced stale-content exposure.
- Faster outdated-content correction turnaround.
- Higher save/remind usage.

## 8. Risks and Mitigations

- Tag quality inconsistency across resources/community.
  - Mitigation: tag audit and backfill before broad rollout.
- UX overload on hub page.
  - Mitigation: progressive disclosure and experiments.
- Low reminder adoption.
  - Mitigation: simplify reminder UX and test timing.

## 9. Dependencies

- Existing resources resolver and APIs.
- Journey API and mobile/web parity routes.
- Analytics event schema and dashboard support.
- Content operations for freshness governance.

## 10. Release Strategy

- Phase 1: Need-first entry + trust labels + baseline analytics.
- Phase 2: Journey next-best-action + cross-links + save/remind.
- Phase 3: Ranking optimization + experiments + iterative tuning.
