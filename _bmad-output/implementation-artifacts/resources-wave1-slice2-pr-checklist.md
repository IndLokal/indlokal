# Wave 1 Slice 2 PR Checklist (A2)

Date: 2026-06-10
PR Slice: A2 owned-content governance gate in admin create/edit
Branch: feat/resources-wave1-a2-owned-governance-gate

## Scope

- Add content mode (CURATED vs OWNED) in admin resource form
- Enforce owned-only governance rationale on create/update
- Persist governance payload to metadata.governance
- Write ContentLog audit row for governance decision
- Hydrate governance defaults on edit flow

## Planned File Checklist

- [x] apps/web/src/components/admin/ResourceForm.tsx
- [x] apps/web/src/app/admin/(dashboard)/data/actions.ts
- [x] apps/web/src/app/admin/(dashboard)/data/resources/new/page.tsx
- [x] apps/web/src/app/admin/(dashboard)/data/resources/[id]/page.tsx
- [x] apps/web/src/app/admin/(dashboard)/data/resources/page.tsx (optional low-effort summary)
- [x] apps/web/src/app/admin/(dashboard)/**tests**/resource-governance.integration.test.ts (new)

## Validation Checklist

- [x] OWNED create without rationale returns validation error
- [x] CURATED create path remains successful without owned-only fields
- [x] OWNED update persists metadata.governance
- [x] ContentLog entry exists for create/update governance decision
- [x] Web typecheck passes
- [x] Web lint passes
- [ ] Manual QA: create/edit form conditional behavior confirmed

## Planned Commands

```bash
pnpm -F web test -- "src/app/admin/(dashboard)/__tests__/resource-governance.integration.test.ts"
pnpm -F web typecheck
pnpm -F web lint
```

## PR Notes

- Keep implementation additive and backward-compatible.
- Do not alter existing curated flow semantics.
- Keep governance validation behind the agreed Wave 1 rubric.
