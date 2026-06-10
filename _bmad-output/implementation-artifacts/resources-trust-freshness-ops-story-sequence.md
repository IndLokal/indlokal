# Resources Trust, Freshness, and Ops Story Sequence

Date: 2026-06-10
Source: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
Status: ready-for-execution after current post-close commitments are cleared

## Canonical Reference Model

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Current execution gate: `resources-sprint-execution-board.md`

This file owns sequencing only.

## Execution Order

### Wave 1 - Trust Contract

1. Story A1 Resource trust read model and surface contract
2. Story A2 Owned-content governance gate

### Wave 2 - Freshness Operating System

3. Story B1 Freshness lifecycle automation
4. Story B2 Re-verification queue and SLA

### Wave 3 - Supply Ops and Measurement Closeout

5. Story C1 Journey-gap to supply ops loop
6. Story C2 Section 17 KPI and dashboard contract

## Delivery Notes

- Do not reopen closed Sprint 1 / Sprint 2 UX shell decisions.
- Web contract stabilizes before any mobile parity extension.
- Governance and trust semantics ship before lifecycle automation.
- Lifecycle automation ships before queue and KPI closeout.

## Engineering Path Map

- Resource resolver/ranking: `apps/web/src/modules/resources/resolver.ts`
- Resource hub/category/journey: `apps/web/src/app/[city]/resources/page.tsx`, `apps/web/src/app/[city]/resources/[category]/page.tsx`, `apps/web/src/app/[city]/resources/journey/page.tsx`
- Resource APIs: `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`
- Admin data/actions: `apps/web/src/app/admin/(dashboard)/data/actions.ts`, `apps/web/src/components/admin/ResourceForm.tsx`
- Journey coverage: `apps/web/src/modules/journeys/coverage.ts`
- Analytics contract: `apps/web/src/lib/analytics/events.ts`, `apps/mobile/lib/analytics/events.ts`

## Effort Summary (Story Points)

- Story A1 Resource trust read model and surface contract: 5 points
- Story A2 Owned-content governance gate: 3 points
- Story B1 Freshness lifecycle automation: 8 points
- Story B2 Re-verification queue and SLA: 5 points
- Story C1 Journey-gap to supply ops loop: 5 points
- Story C2 Section 17 KPI and dashboard contract: 3 points
- Total: 29 points

## Owner Tags

- PM: Product Manager / acceptance / rollout decisions
- BE-PLATFORM: backend models, lifecycle logic, APIs
- FE-WEB: web resource surfaces and admin screens
- FE-MOBILE: mobile parity after web contract stabilizes
- DATA-ANALYTICS: metrics and dashboard/readout contracts
- OPS: queue handling, SLAs, governance review
- QA: validation and release gates
