# Wave 2 B1 PR Checklist (Freshness Lifecycle Automation)

Date: 2026-06-10
PR Slice: B1 lifecycle state projection + stale demotion guardrails
Branch: feat/resources-wave2-b1-freshness-lifecycle

## Scope

- Compute TTL from `lastReviewedAt + reviewCadenceDays`
- Project lifecycle state (`IN_TTL`, `STALE_DEMOTED`, `PROLONGED_STALE`, `HIDDEN_ARCHIVED`)
- Apply deterministic stale demotion in resolver ranking
- Apply explicit auto-hide guardrail path for prolonged stale rows
- Expose freshness contract in resources APIs and web surfaces

## File Checklist

- [x] apps/web/src/modules/resources/freshness-lifecycle.ts (new)
- [x] apps/web/src/modules/resources/resolver.ts
- [x] apps/web/src/modules/resources/index.ts
- [x] apps/web/src/app/api/v1/cities/[slug]/resources/route.ts
- [x] apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts
- [x] apps/web/src/app/[city]/resources/page.tsx
- [x] apps/web/src/app/[city]/resources/journey/page.tsx
- [x] apps/web/src/modules/resources/**tests**/resolver.test.ts
- [x] apps/web/src/app/api/v1/**tests**/resources.integration.test.ts
- [x] apps/web/src/modules/journeys/**tests**/compose.test.ts (fixture sync)

## Validation Checklist

- [x] Resolver tests pass including stale demotion and auto-hide guardrail coverage
- [x] Resources API integration tests pass with freshness payload assertions
- [x] Web typecheck passes
- [x] Web lint passes
- [ ] Manual QA: compare lifecycle badges on hub and journey for same stale/fresh resources
- [ ] Manual QA: verify prolonged stale auto-hide behavior with `metadata.freshness.allowAutoHide=true`

## Commands Run

```bash
pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts
pnpm -F web test -- src/app/api/v1/__tests__/resources.integration.test.ts
pnpm -F web typecheck
pnpm -F web lint
```

## Notes

- Lifecycle behavior is additive and read-model driven; no schema migration in this slice.
- Auditable state transitions to persisted lifecycle columns/queue are deferred to B2 follow-up wiring.
