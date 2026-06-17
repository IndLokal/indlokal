# Story 3.1: Related Communities and Events Modules

Status: See resources-sprint-execution-board.md
Epic: Information to Real-World Action
Priority: P0
Sprint Target: Sprint 2
Owner: Product + Web + API

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX related-action model: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Bridge resources to communities and events at the right decision points to move users from reading to participation.

## Acceptance Criteria

1. Related communities module appears on resource contexts where data exists.
2. Related events module appears with upcoming event relevance.
3. Ranking/ordering of related items follows defined relevance rules.
4. Links resolve correctly to community/event pages.
5. Click-through events are tracked.

## Telemetry (Required)

- resource_related_module_impression
- resource_related_community_click
- resource_related_event_click

## QA Gates

- Modules hidden cleanly when no relevant items.
- No broken links across city scopes.
- Relevance quality check passes for pilot city.
- Performance remains acceptable.

## Engineering Subtasks by Path

- Matching queries: use community/event retrieval modules and filters in `apps/web/src/modules/community/queries.ts` and event module equivalents.
- Web UI modules: render related blocks in `apps/web/src/app/[city]/resources/page.tsx` and/or resource category/detail surfaces.
- API composition: add relation payload fields to `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts` (or companion endpoint).
- Mobile follow-up: mirror related modules where applicable in `apps/mobile/app/resources/index.tsx`.
- Analytics: track module impressions/clicks via `apps/web/src/lib/analytics/events.ts` and `apps/mobile/lib/analytics/events.ts`.

## Definition of Done

- Acceptance criteria met.
- Modules enabled behind controlled rollout.
- Product review confirms actionability lift.
