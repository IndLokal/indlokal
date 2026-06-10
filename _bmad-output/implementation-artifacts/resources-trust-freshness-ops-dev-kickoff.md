# Resources Trust/Freshness/Ops - Developer Kickoff (Wave 1: A1 + A2)

Date: 2026-06-10
Owner: Amelia (Senior Engineer kickoff)
Primary architecture input: `resources-trust-freshness-ops-architecture-handoff.md`
Supporting inputs: execution board, story sequence, QA checklist

## 0) Scope Lock and Preconditions

This kickoff is intentionally scoped to Wave 1 only:

- A1: Resource trust read model and surface contract
- A2: Owned-content governance gate

Non-goals for this kickoff:

- No B1/B2/C1/C2 implementation
- No schema redesigns beyond additive/optional changes
- No mobile changes

Precondition gate before coding (from execution board):

1. Mandatory post-close commitments on `resources-sprint-execution-board.md` are complete.
2. PM signs off trust vocabulary + governance rubric.

## 1) Two Implementation PR Slices (small + mergeable)

## Slice 1 (PR-1): A1 Trust Read Contract Across Resolver/API/Web Surfaces

Goal:

- Remove page-local trust heuristics and establish one resolver-driven trust projection consumed consistently by hub/category/journey and both resources APIs.

Why this first:

- Current drift exists: trust labels are derived locally in page components (`trustLabelForType`, `trustLabel`) instead of a shared contract.

Change shape:

- Additive and backward-compatible: append trust object fields; do not remove existing response fields.

Deliverables in this PR:

1. Shared trust projection module for resources.
2. Resolver emits trust projection with each resource.
3. `/api/v1/cities/[slug]/resources` serializes trust projection.
4. `/api/v1/cities/[slug]/resources/journey` serializes trust projection.
5. Hub/category/journey pages consume trust projection directly (no local trust classification logic).
6. Honest fallback copy for unknown verification data.

Suggested branch/PR:

- Branch: `feat/resources-wave1-a1-trust-contract`
- PR title: `A1: resources trust read contract across resolver, APIs, and web surfaces`

## Slice 2 (PR-2): A2 Owned-Content Governance Gate in Admin Create/Edit

Goal:

- Gate owned-content writes with required rationale while keeping curated flow unchanged.

Why second:

- Depends on agreed governance rubric; isolated to admin write path and auditability.

Change shape:

- Additive and backward-compatible: store governance payload under `Resource.metadata.governance` and avoid breaking existing admin paths.

Deliverables in this PR:

1. Admin form supports `contentMode` + governance rationale fields.
2. Server action conditionally validates governance fields only for `contentMode=OWNED`.
3. Governance payload persisted in `metadata.governance` (plus marker metadata as needed).
4. `ContentLog` row written for create/update governance decision summary (`entityType: 'resource'`).
5. Admin edit path hydrates governance defaults from metadata.

Suggested branch/PR:

- Branch: `feat/resources-wave1-a2-owned-governance-gate`
- PR title: `A2: owned-content governance gate for resource admin writes`

## 2) File-by-File Touch List

## Slice 1 (A1) touch list

Core modules:

- `apps/web/src/modules/resources/resolver.ts`
  - Add trust projection fields to `ResolvedResource` and compute from row data.
- `apps/web/src/modules/resources/index.ts`
  - Export any new trust projection types/helpers.
- `apps/web/src/modules/resources/trust-read-model.ts` (new)
  - Canonical mapping function(s), fallback semantics, display-safe labels.

API routes:

- `apps/web/src/app/api/v1/cities/[slug]/resources/route.ts`
  - Serialize trust projection fields.
- `apps/web/src/app/api/v1/cities/[slug]/resources/journey/route.ts`
  - Serialize same trust projection fields.

Web surfaces:

- `apps/web/src/app/[city]/resources/page.tsx`
  - Remove local trust heuristics (`trustLabelForType` usage) and consume projected trust object.
- `apps/web/src/app/[city]/resources/[category]/page.tsx`
  - Render trust object consistently on cards/list entries.
- `apps/web/src/app/[city]/resources/journey/page.tsx`
  - Remove local trust heuristics (`trustLabel` usage) and consume projected trust object.

Tests:

- `apps/web/src/modules/resources/__tests__/resolver.test.ts`
  - Add/adjust mapping assertions for trust projection.
- `apps/web/src/app/api/v1/__tests__/resources.integration.test.ts`
  - Assert trust fields are present and stable in API payload.

Optional UI dedupe helper if needed:

- `apps/web/src/components/resources/TrustBadge.tsx` (new)
  - Shared display component to reduce surface drift.

## Slice 2 (A2) touch list

Admin form and pages:

- `apps/web/src/components/admin/ResourceForm.tsx`
  - Add `contentMode` selector and owned-governance conditional fields.
- `apps/web/src/app/admin/(dashboard)/data/resources/new/page.tsx`
  - Ensure create form path supports new fields.
- `apps/web/src/app/admin/(dashboard)/data/resources/[id]/page.tsx`
  - Hydrate governance defaults from `resource.metadata.governance`.

Server actions:

- `apps/web/src/app/admin/(dashboard)/data/actions.ts`
  - Extend resource input parsing.
  - Add conditional governance validator for OWNED mode.
  - Persist `metadata.governance`.
  - Add `db.contentLog.create` audit entry on create/update.

Admin readout (recommended in same PR if low effort):

- `apps/web/src/app/admin/(dashboard)/data/resources/page.tsx`
  - Add thin governance summary chip/column for auditability.

Tests:

- `apps/web/src/app/admin/(dashboard)/__tests__/resource-governance.integration.test.ts` (new)
  - Owned path rejected without rationale.
  - Curated path accepted without owned-only fields.
  - Metadata persistence + content log assertions.

## 3) Test Plan Per Slice

## Slice 1 test plan

Unit:

1. `resolver.test.ts` - trust projection mapping for:
   - complete verification data
   - missing verification data (honest fallback)
   - stale/fresh interaction display fields if included in projection

Integration:

1. `resources.integration.test.ts`:
   - `/api/v1/cities/:slug/resources` includes trust contract for each item
   - `/api/v1/cities/:slug/resources/journey` includes same trust contract
   - legacy fields still present (backward compatibility)

Manual:

1. Open `/{city}/resources`, `/{city}/resources/{category}`, `/{city}/resources/journey` for same seeded resource.
2. Confirm trust wording + verification info are identical across all three surfaces.
3. Confirm unknown data degrades to non-overclaim copy.

## Slice 2 test plan

Unit:

1. Validator helper tests (if extracted) for governance required-field matrix by `contentMode`.

Integration:

1. New admin governance integration test file:
   - create OWNED without rationale => validation error
   - create CURATED without owned rationale => success
   - update OWNED with rationale => `metadata.governance` persisted
   - content log row created with governance decision summary

Manual:

1. In admin create form, switch mode CURATED <-> OWNED and confirm field visibility.
2. Submit OWNED without rationale fields and verify understandable validation errors.
3. Submit OWNED with full rationale and verify saved metadata on edit reload.
4. Verify content log evidence for the write.

## 4) Feature-Flag Plan + Rollback Notes

Use additive flags in existing flag module.

Files:

- `apps/web/src/lib/config/flags.ts`
- `apps/web/.env.example`

Recommended flags for Wave 1:

1. `FEATURE_RESOURCES_TRUST_CONTRACT` (default `false` during rollout)
2. `FEATURE_RESOURCES_OWNED_GOVERNANCE` (default `false` during rollout)

Rollout:

1. Deploy with both flags off (dark launch).
2. Enable trust contract first.
3. Enable governance gate second after admin UAT.

Rollback levels:

1. If trust UI regression: set `FEATURE_RESOURCES_TRUST_CONTRACT=false`.
2. If admin friction/regression: set `FEATURE_RESOURCES_OWNED_GOVERNANCE=false`.
3. Keep data safe: metadata writes are additive; no destructive migration rollback required.

Notes:

- Keep legacy rendering fallback for one release window while trust contract bakes.
- Keep governance validator behind flag until PM/Ops rubric signoff.

## 5) Definition of Done (Concrete)

## Slice 1 DoD

- [ ] Shared trust read-model exists and is used by resolver.
- [ ] Both resources APIs return trust fields from same projection contract.
- [ ] Hub/category/journey no longer compute local trust labels.
- [ ] Honest fallback copy used for missing verification data.
- [ ] Unit + integration tests added/updated and passing.
- [ ] No schema migration required; behavior remains backward-compatible.
- [ ] QA checklist evidence captured for A1 (screenshots + wording signoff).

## Slice 2 DoD

- [ ] Admin form supports `contentMode` with conditional governance fields.
- [ ] OWNED write path hard-fails without required rationale.
- [ ] CURATED path remains unaffected.
- [ ] Governance payload persisted under `metadata.governance`.
- [ ] ContentLog audit row written for governance decisions.
- [ ] Integration tests cover create/update + validation + audit.
- [ ] QA checklist evidence captured for A2 (screenshots + validation + audit proof).

## 6) Exact Recommended Local Validation Command Sequence

Run from repo root:

```bash
pnpm install

# Ensure web Prisma client is current before tests touching schema/types
pnpm -F web db:generate

# Ensure test DB schema is in sync (idempotent)
pnpm -F web test:setup

# Slice 1 focused checks
pnpm -F web test -- src/modules/resources/__tests__/resolver.test.ts
pnpm -F web test -- src/app/api/v1/__tests__/resources.integration.test.ts

# Slice 2 focused checks (after PR-2 test file exists)
pnpm -F web test -- "src/app/admin/(dashboard)/__tests__/resource-governance.integration.test.ts"

# Type + lint gates for both slices
pnpm -F web typecheck
pnpm -F web lint
```

Manual verification runbook:

```bash
# Start app
pnpm -F web dev

# Then verify in browser:
# 1) /stuttgart/resources
# 2) /stuttgart/resources/city-registration
# 3) /stuttgart/resources/journey
# 4) /admin/data/resources/new
# 5) /admin/data/resources/:id
```

## 7) PR Order and Merge Rules

1. Merge Slice 1 first.
2. Validate A1 QA evidence + PM wording signoff.
3. Merge Slice 2 second.
4. Validate A2 QA evidence + Ops rubric signoff.

Hard rule:

- Do not begin Wave 2 (B1/B2) until both Wave 1 slices are merged and signed off.
