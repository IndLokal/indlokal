# ADR-0003: Three-tier database seeding (bootstrap / directory / demo)

- **Date:** 2026-05-09
- **Status:** Accepted

## Context

The single `prisma/seed.ts` we shipped at MVP did three jobs at once:
reference data, editorial directory rows, and demo content for local dev. That
made it unsafe to run in production (you'd plant fake events) and unsafe to
re-run in dev (you'd duplicate or stomp curated rows). It also blocked
deploy-time bootstrap because a partial seed would leak demo content into prod.

We need:

1. A truly idempotent step that runs on every prod deploy to guarantee
   reference data exists (cities, categories, personas, the platform admin).
2. A create-only step that plants curated communities/resources without
   touching anything that already exists, runnable in any environment.
3. A demo step that is **never** run in production but is one command for
   local + staging.

## Decision

Split seeding into three tiers, each its own entry point and each gated by a
distinct env flag:

| Tier      | Entry                                | Idempotent?                        | Env gate                   | Safe in prod |
| --------- | ------------------------------------ | ---------------------------------- | -------------------------- | ------------ |
| Bootstrap | `prisma/bootstrap.ts`                | Yes — `upsert` only                | `RUN_BOOTSTRAP_SEED=true`  | Yes          |
| Directory | `prisma/directory.ts`                | Create-only (skips existing slugs) | `RUN_DIRECTORY_SEED=true`  | Yes          |
| Demo      | `prisma/seed.ts` (events + fixtures) | No — re-creates fixtures           | Manual `pnpm db:seed:demo` | **No**       |

Vercel `build:vercel` runs `maybe-bootstrap.cjs` and `maybe-directory.cjs`
which no-op unless their flag is set and `DATABASE_URL` is present. Demo is
never wired into a deploy pipeline.

Bootstrap also seeds the platform admin user (`ADMIN_EMAIL`, default
`admin@indlokal.com`). Adding a new admin is a SQL update, not a code change.

## Consequences

- **Positive:** safe deploy-time data guarantees; no demo bleed; admin
  bootstrap is a deploy concern, not a manual step; idempotent runs are now
  a normal admin operation (the `/admin/data` "Run bootstrap" button).
- **Negative:** three files to maintain instead of one; an admin must
  understand which tier to extend when adding new reference data.
- **Neutral:** the demo seed continues to grow with new screens/fixtures;
  it's the long-tail "happy path" data only.

## Alternatives considered

- **Single seed with `if (process.env.NODE_ENV)` guards** — rejected; one bug
  in the guard plants demo content in prod.
- **Migrations-as-data** — rejected; reference data updates would generate
  migration churn and Prisma migrations are append-only.
- **External fixture loader (sql files via `psql`)** — rejected; loses
  type-safety on category slugs and admin email.
