# Story A1: Resource Trust Read Model and Surface Contract

Status: See resources-trust-freshness-ops-execution-board.md
Track: Resources Trust, Freshness, and Ops
Priority: P1
Wave Target: Wave 1
Owner: Product + FE-WEB + BE-PLATFORM

## Canonical References

- Track plan: `../planning-artifacts/resources-trust-freshness-ops-plan.md`
- Story sequencing: `resources-trust-freshness-ops-story-sequence.md`

## Story Intent

Replace proxy-only trust cues with an explicit, stable trust contract on resource surfaces.

## Acceptance Criteria

1. Resource read model exposes `trustBand`, `sourceLabel`, `lastVerifiedAtDisplay`, and `verificationMethod`.
2. Hub, category, and journey surfaces render the same trust contract for the same resource.
3. Missing trust inputs degrade honestly to non-overclaim states.
4. Copy uses product-approved trust vocabulary consistently.
5. Contract is stable before any mobile parity extension begins.

## QA Gates

- Cross-surface consistency verified.
- No over-claim language in UI.
- Last-verified display behaves predictably for null values.

## Engineering Path Focus

- Resolver/read model: `apps/web/src/modules/resources/resolver.ts`
- Web surfaces: `apps/web/src/app/[city]/resources/page.tsx`, `apps/web/src/app/[city]/resources/[category]/page.tsx`, `apps/web/src/app/[city]/resources/journey/page.tsx`
- API: `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`

## Definition of Done

- Acceptance criteria met.
- Wave 1 trust contract approved by Product.
- Ready to support freshness lifecycle work.
