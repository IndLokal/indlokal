# Wave 1 Slice 1 PR Checklist (A1)

Date: 2026-06-10
PR Slice: A1 trust read contract across resolver/API/web
Branch: feat/resources-wave1-a1-trust-contract

## Scope

- Shared trust read model for resources
- Resolver emits trust projection
- APIs include trust object in payload
- Hub/category/journey consume trust projection (no local trust classification)

## File Checklist

- [x] apps/web/src/modules/resources/trust-read-model.ts (new)
- [x] apps/web/src/modules/resources/resolver.ts
- [x] apps/web/src/modules/resources/index.ts
- [x] apps/web/src/app/api/v1/cities/[slug]/resources/route.ts
- [x] apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts
- [x] apps/web/src/app/[city]/resources/page.tsx
- [x] apps/web/src/app/[city]/resources/[category]/page.tsx
- [x] apps/web/src/app/[city]/resources/journey/page.tsx
- [x] apps/web/src/modules/resources/**tests**/resolver.test.ts
- [x] apps/web/src/app/api/v1/**tests**/resources.integration.test.ts
- [x] apps/web/src/modules/journeys/**tests**/compose.test.ts (fixture update for new type fields)

## Validation Checklist

- [x] Resolver unit tests pass
- [x] Resources integration tests pass
- [x] Web typecheck passes
- [ ] Web lint passes
- [ ] Manual QA: trust wording is consistent across hub/category/journey for same resource
- [ ] Manual QA: unknown verification state shows honest fallback copy

## Commands Run

```bash
pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts
pnpm -F web test -- src/app/api/v1/__tests__/resources.integration.test.ts
pnpm -F web typecheck
```

## PR Notes

- Change is additive and backward-compatible: existing API fields remain unchanged.
- New trust object is appended on resource payloads.
- Category page now displays source label, trust band label, and verified display date.
