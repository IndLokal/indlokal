# Resources Improvement Story Sequence

Date: 2026-06-10
Source: resources-improvement-prd-one-pager.md, resources-improvement-epics-stories.md, resources-improvement-two-sprint-plan.md
Status: ready-for-execution

## Canonical Reference Model (Dedup)

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX IA and interaction model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Story intent and acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

This file owns sequencing only.

## Execution Order

### Sprint 1

1. Story 1.1 Persona quick-start modules
2. Story 1.2 Intent chips and smart essentials
3. Story 2.1 Next best action in journey
4. Story 3.2 Resource-to-action CTA hierarchy
5. Story 2.3 Completion and resume logic
6. Story 4.3 Experimentation and dashboard baseline

### Sprint 2

7. Story 3.1 Related communities/events modules
8. Story 2.2 Save and remind actions
9. Story 1.3 Trust and freshness on cards
10. Story 4.1 Ranking updates with freshness/trust

### Sprint 3+

11. Story 4.2 Outdated feedback loop

## Delivery Notes

- Keep existing city routes and SEO behavior stable.
- Feature-flag all new hub modules.
- Require analytics instrumentation before rollout.
- Run a tag coverage checkpoint before enabling advanced personalization.

## Engineering Path Map

- Web resources hub: `apps/web/src/app/[city]/resources/page.tsx`
- Web journey page: `apps/web/src/app/[city]/resources/journey/page.tsx`
- Web resources API: `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`
- Web journey API: `apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts`
- Web resolver logic: `apps/web/src/modules/resources/resolver.ts`
- Web analytics events: `apps/web/src/lib/analytics/events.ts`
- Mobile resources screen: `apps/mobile/app/resources/index.tsx`
- Mobile journey screen: `apps/mobile/app/resources/journey.tsx`
- Mobile consular resources module: `apps/mobile/lib/resources/consular.ts`
- Mobile analytics catalog: `apps/mobile/lib/analytics/events.ts`

## Story Readiness Checklist

- Scope: clear, no cross-epic ambiguity.
- Acceptance criteria: testable and observable.
- Dependencies: identified and sequenced.
- Telemetry: event names and success metrics defined.
- Rollout: flag, QA matrix, and rollback path included.

## Effort Summary (Story Points)

### Sprint 1

- Story 1.1 Persona quick-start modules: 5 points
- Story 1.2 Intent chips and smart essentials: 5 points
- Story 2.1 Next best action in journey: 5 points
- Story 3.2 Resource-to-action CTA hierarchy: 3 points
- Story 2.3 Completion and resume logic: 5 points
- Story 4.3 Experimentation and dashboard baseline: 3 points
- Sprint 1 total: 26 points

### Sprint 2

- Story 3.1 Related communities/events modules: 5 points
- Story 2.2 Save and remind actions: 8 points
- Story 1.3 Trust and freshness on cards: 3 points
- Story 4.1 Ranking updates with freshness/trust: 5 points
- Sprint 2 total: 21 points

### Sprint 3+

- Story 4.2 Outdated feedback loop: 5 points
- Sprint 3+ total: 5 points

## Owner Tags

- PM: Product Manager / requirements / acceptance
- FE-WEB: Web frontend
- FE-MOBILE: Mobile frontend
- BE-API: Backend/API and resolver logic
- DATA-ANALYTICS: Event schema and dashboards
- QA: Validation and release quality gates
