# Wave 2 B2 PR Checklist (Reverification Queue + SLA)

Date: 2026-06-10
PR Slice: B2 stale-resource reverification queue and SLA operations
Branch: feat/resources-wave2-b2-reverification-queue

## Scope

- Add queue model for stale/high-risk resource review
- Add deterministic queue ingestion from lifecycle output
- Add weighted priority scoring (risk, traffic, staleness, criticality)
- Add assignment + SLA + resolution actions
- Add cron ingestion route
- Add admin queue surface with filters and operations
- Add migration for new schema objects

## File Checklist

- [x] apps/web/prisma/schema.prisma
- [x] apps/web/prisma/migrations/20260610190000_add_resource_reverification_queue/migration.sql
- [x] apps/web/src/modules/resources/reverification/index.ts
- [x] apps/web/src/modules/resources/reverification/**tests**/integration.test.ts
- [x] apps/web/src/app/api/cron/resources/reverification/route.ts
- [x] apps/web/src/app/admin/(dashboard)/data/actions.ts
- [x] apps/web/src/app/admin/(dashboard)/data/resources/reverification/page.tsx
- [x] apps/web/src/app/admin/(dashboard)/data/resources/page.tsx (queue link)
- [x] apps/web/src/app/admin/(dashboard)/data/page.tsx (queue tile)
- [x] apps/web/src/lib/config/flags.ts
- [x] apps/web/src/test/db-helpers.ts

## Validation Checklist

- [x] Queue rows create deterministically for stale resources only
- [x] Queue upsert is idempotent by resource
- [x] Assignment and SLA update flow is persisted and auditable
- [x] Resolution flow updates queue state and resource state atomically
- [x] Migration SQL file exists in repo
- [x] Web typecheck passes
- [x] Web lint passes

## Commands Run

```bash
pnpm -F web db:generate
DATABASE_URL='postgresql://postgres:postgres@localhost:5434/indlokal_test?schema=public' pnpm -F web exec prisma db push --skip-generate
pnpm -F web test -- src/modules/resources/reverification/__tests__/integration.test.ts
pnpm -F web typecheck
pnpm -F web lint
```

## Notes

- `prisma migrate dev --create-only` was blocked by local DB drift; migration SQL was authored and committed manually as canonical rollout artifact.
- Queue ingestion cron remains flag-gated (`RESOURCES_REVERIFICATION_QUEUE_ENABLED=true`).
- Manual browser QA for admin queue interactions remains a follow-up, but implementation and automated gates are complete.
