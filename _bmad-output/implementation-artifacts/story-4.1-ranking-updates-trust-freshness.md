# Story 4.1: Ranking Updates with Trust and Freshness

Status: See resources-sprint-execution-board.md
Epic: Measurement and Quality
Priority: P1
Sprint Target: Sprint 2
Owner: Product + Backend + Search/Ranking

## Canonical References

- Strategy and sprint gates: `../planning-artifacts/resources-improvement-two-sprint-plan.md`
- UX trust/freshness behavior intent: `../planning-artifacts/resources-ux-redefinition-blueprint.md`
- Epic acceptance contract: `../planning-artifacts/resources-improvement-epics-stories.md`

## Story Intent (Delta Only)

Improve ordering quality by integrating trust/freshness scoring with transparent, debuggable ranking behavior.

## Acceptance Criteria

1. Ranking policy includes freshness and trust components.
2. Stale resources receive lower effective rank unless explicitly exempt.
3. Ranking output can be inspected for debugging/validation.
4. No severe regressions in relevance for key intents.
5. Ranking-related telemetry is available.

## Telemetry (Required)

- resources_rank_score_computed
- resources_stale_penalty_applied
- resources_result_click_position

## QA Gates

- Freshness penalties behave according to policy.
- No high-priority critical resources accidentally buried.
- Debug output available for sampled requests.
- Ranking changes validated on pilot cities.

## Engineering Subtasks by Path

- Ranking logic: implement score weighting in `apps/web/src/modules/resources/resolver.ts`.
- API observability: expose score/debug metadata (guarded) in `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`.
- Web UI validation: verify order effects on `apps/web/src/app/[city]/resources/page.tsx`.
- Mobile UI validation: verify order effects on `apps/mobile/app/resources/index.tsx`.
- Telemetry: capture ranking diagnostics and click position in `apps/web/src/lib/analytics/events.ts` and `apps/mobile/lib/analytics/events.ts`.

## Definition of Done

- Acceptance criteria met.
- Product sign-off on relevance and quality checks.
- Controlled rollout with monitoring alerts configured.
