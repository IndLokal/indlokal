# IndLokal — End-to-End Deployment Setup

This is the **single source of truth** for setting up IndLokal's web deployment chain. Follow it top to bottom once, and the system is ready for repeated, safe production releases.

> Audience: someone setting this up from scratch (or repairing it).
> Time: ~30–45 minutes if accounts already exist.

---

## 1. Architecture at a glance

```
┌────────────────────┐                    ┌──────────────────────┐
│ Developer pushes   │                    │ Neon Postgres        │
│ feature branch /   │                    │  • indlokal-db       │ (production)
│ opens PR           │                    │  • indlokal-db-stag…  │ (staging)
└─────────┬──────────┘                    └──────────────────────┘
          │                                          ▲
          │                                          │  prisma migrate deploy
          ▼                                          │  + reads at runtime
┌────────────────────┐         ┌────────────────────┴───────────┐
│ GitHub Actions CI  │         │ Vercel — apps/web (Next.js)    │
│ (validate code)    │         │  • Production env  → indlokal-db│
│  • typecheck       │         │  • Preview env     → indlokal-db-staging│
│  • lint            │         │  build cmd: pnpm run build:vercel │
│  • test (ephemeral │         │   = prisma generate              │
│    Postgres)       │         │     prisma migrate deploy        │
│  • build (ephem.)  │         │     next build                   │
│  • migrate apply   │         └────────────────────────────────┘
│    against ephem.  │
│    DB to validate  │
└────────────────────┘
```

**Key principle:** Prisma migrations run **inside the Vercel build for each deployment**, against that deployment's own `DATABASE_URL`. This means a Preview deployment migrates the staging DB, a Production deployment migrates the production DB. If the migration fails, the deployment fails — broken schemas never go live.

GitHub Actions never writes to a real Neon database. It only validates that committed code (and committed migrations) work correctly.

---

## 2. Prerequisites

Accounts you need:

| Service          | Plan needed for MVP    | How to create                                                        |
| ---------------- | ---------------------- | -------------------------------------------------------------------- |
| GitHub           | repo access            | already have it                                                      |
| Vercel           | Hobby (free)           | sign up at [vercel.com](https://vercel.com) — login with GitHub      |
| Neon             | Free                   | **created from inside Vercel in step 4** — no separate signup needed |
| Domain registrar | only when going public | any registrar                                                        |

You should already have:

- The `ind-lokal` repo on GitHub
- A Vercel account (free tier is fine)

You do **not** need to visit [console.neon.tech](https://console.neon.tech) at all. Vercel will provision Neon for you. Visiting the Neon console later is optional (see [§4a](#4a-optional--use-the-neon-console-directly)).

---

## 3. Vercel — create the project

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → select the `ind-lokal` repo.
3. On the configuration screen:

| Setting                        | Value                                         |
| ------------------------------ | --------------------------------------------- |
| Framework Preset               | Next.js                                       |
| Root Directory                 | `apps/web`                                    |
| Build Command                  | `pnpm run build:vercel`                       |
| Install Command                | `pnpm install --frozen-lockfile`              |
| Output Directory               | _(leave empty — Vercel uses Next.js default)_ |
| Include files outside root dir | **Enabled** (required for `packages/shared`)  |
| Node.js Version                | `20.x`                                        |
| Production Branch              | `main` (default)                              |

Important: the Vercel Root Directory must be the filesystem path `apps/web`. Do not enter `web` there. `web` is only the pnpm workspace name used in commands like `pnpm --filter web`.

4. Do **not** worry about env vars yet — you'll add them in step 5 after the database is created.
5. Click **Deploy**. The first deploy will fail with a missing-`DATABASE_URL` error. That's expected and harmless — proceed to step 4.

> The `build:vercel` script lives in [`apps/web/package.json`](../../apps/web/package.json) and runs:
> `prisma generate && prisma migrate deploy && next build`

---

## 4. Vercel Storage — create both Neon databases

You will create the two databases (production + staging) directly from the Vercel dashboard. Vercel provisions them on Neon's infrastructure and wires the env vars automatically.

### 4.1 Create the production database

1. In your Vercel project → **Storage** tab → **Create Database** → choose **Neon — Serverless Postgres** → **Continue**.
2. Authorize the Neon integration the first time you use it (signs you up on Neon transparently).
3. In the create dialog:
   - **Database Name**: `indlokal-db`
   - **Region**: pick an EU region — `Frankfurt, Germany (eu-central-1)` recommended
   - **Plan**: Free
4. Click **Create**.
5. After creation, Vercel shows the "Connect Project" modal. Set:
   - **Environments**: ✅ Production only (uncheck Preview and Development)
   - **Create Database Branch For Deployment**: leave both unchecked
   - **Custom Environment Variable Prefix**: change `STORAGE` → `DATABASE`
   - **Sensitive**: leave on
6. Click **Connect**.

### 4.2 Create the staging database

1. Back in **Storage** → **Create Database** → **Neon — Serverless Postgres** → **Continue**.
2. In the create dialog:
   - **Database Name**: `indlokal-db-staging`
   - **Region**: same EU region as production
   - **Plan**: Free
3. Click **Create**.
4. In the "Connect Project" modal:
   - **Environments**: ✅ Preview only (uncheck Production and Development)
   - **Create Database Branch For Deployment**: leave both unchecked
   - **Custom Environment Variable Prefix**: change `STORAGE` → `DATABASE`
   - **Sensitive**: leave on
5. Click **Connect**.

### 4.3 Verify

Go to **Settings → Environment Variables**. You should see `DATABASE_URL` listed **twice** with different scope badges:

```
DATABASE_URL   [Production]   postgres://…indlokal-db…
DATABASE_URL   [Preview]      postgres://…indlokal-db-staging…
```

If either is missing, open the corresponding database in **Storage** → **Settings** and re-run "Connect Project" with the right environment scope and the `DATABASE` prefix.

---

### 4a. Optional — use the Neon console directly

You only need [console.neon.tech](https://console.neon.tech) for things Vercel does not surface:

- Inspecting tables / running ad-hoc SQL via the Neon SQL Editor
- Adjusting compute size or autoscaling
- Manually resetting the staging DB
- Recovering from `_prisma_migrations` problems (see [§9](#9-troubleshooting))

To get there: open Vercel → **Storage** → click the database → **Open in Neon**. Vercel provisions databases inside a Neon project under your linked Neon account; the link logs you in automatically.

---

## 5. Vercel — application environment variables

Add these in your Vercel project → **Settings → Environment Variables**. Apply each to **All Environments** unless noted. (You added the database via Storage in §4; this section covers the rest of the app's runtime config.)

### Required for any deployment

| Key                    | Value                                                                                                                                                        | Scope          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `NEXT_PUBLIC_APP_NAME` | `IndLokal`                                                                                                                                                   | All            |
| `NEXT_PUBLIC_APP_URL`  | Production: your final URL (e.g. `https://indlokal.de`). Preview: leave the same or set per-env.                                                             | All (or split) |
| `CRON_SECRET`          | Output of `openssl rand -hex 32`                                                                                                                             | All            |
| `AUTH_JWT_PRIVATE_KEY` | RS256 PKCS#8 PEM. Generate with the snippet below. **Required** — without it every cold start mints a new ephemeral key and invalidates all mobile sessions. | All            |
| `AUTH_JWT_PUBLIC_KEY`  | Matching SPKI PEM for the private key above.                                                                                                                 | All            |
| `RUN_BOOTSTRAP_SEED`   | `true` — runs the idempotent bootstrap during build (cities, categories, personas, admin user).                                                              | All            |
| `RUN_DIRECTORY_SEED`   | `true` — runs the create-only directory + resources seed during build.                                                                                       | All            |

Generate the JWT keypair locally and paste both PEMs into Vercel (replace literal newlines with `\n` if the Vercel UI requires single-line values — the loader unescapes them):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

### Optional — add only when the feature is used

| Key                                                   | Needed for           |
| ----------------------------------------------------- | -------------------- |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                 | real outbound email  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`            | Google sign-in       |
| `OPENAI_API_KEY`                                      | AI pipeline          |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics            |
| `EVENTBRITE_API_KEY`                                  | Eventbrite ingestion |
| `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`                 | Google CSE ingestion |

> `DATABASE_URL` is **not** added manually. It comes from Vercel Storage (step 4).

---

## 6. GitHub Actions — repository secrets

Go to GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret        | Value                                            | Used by                                        |
| ------------- | ------------------------------------------------ | ---------------------------------------------- |
| `APP_URL`     | Your production URL (e.g. `https://indlokal.de`) | [`cron.yml`](../../.github/workflows/cron.yml) |
| `CRON_SECRET` | Same value as in Vercel (step 6)                 | [`cron.yml`](../../.github/workflows/cron.yml) |

That is the entire list. CI does **not** need any database secrets — it uses an ephemeral Postgres container per run.

---

## 7. First deployment — verify the chain

### 7.1 Trigger a Preview

```bash
git checkout -b chore/verify-deploy
git commit --allow-empty -m "chore: verify preview deploy"
git push -u origin chore/verify-deploy
```

Open a PR against `main`. Within ~2 minutes you should see:

1. **GitHub Actions CI** running on the PR (quality → tests → build, all passing).
2. A **Vercel Preview** comment on the PR with a deployment URL.

Click the Preview URL. Verify:

- The home page loads.
- A city page like `/stuttgart` loads (even with no seeded data, it should respond, not error).

If it loads, your **staging DB is connected, migrated, and serving the preview**.

### 7.2 Promote to production

Merge the PR. Within ~2 minutes:

1. **GitHub Actions CI** runs again on `main`.
2. **Vercel Production** builds, runs `prisma migrate deploy` against `indlokal-db`, then deploys.

Open the production URL. If it loads, the chain is fully verified.

---

## 8. Day-to-day workflow

For every change:

```bash
git checkout -b feat/my-thing
# ...edit code, including any new prisma/migrations/<timestamp>_<name>/
pnpm --filter web exec prisma migrate dev --name my_thing   # local migration
git add .
git commit -m "feat: my thing"
git push -u origin feat/my-thing
```

1. Open a PR to `main`.
2. CI runs (validates code + that migrations apply cleanly).
3. Vercel Preview builds (applies migration to staging DB, deploys preview).
4. Visit the preview URL. Verify the migration and the feature both work.
5. Merge to `main`.
6. Vercel Production builds (applies migration to production DB, deploys).

**That's the whole loop.** No tags, no manual steps, no ceremony.

---

## 9. Troubleshooting

### Build fails with "P3005: The database schema is not empty"

The DB has tables but no `_prisma_migrations` table. This happens if someone used `prisma db push` against it. Baseline it:

```bash
pnpm --filter web exec prisma migrate resolve --applied <migration_name>
```

Run against the affected `DATABASE_URL` (staging or production).

### Preview URL works but shows old schema

The migration didn't run. Check the Vercel build logs for the deploy — look for the `prisma migrate deploy` step output. If it errored, fix the migration locally and push again.

### Production deploy succeeded but app errors on requests

A migration applied successfully, but runtime code expects a different schema. Roll back by promoting the previous green Vercel deployment from the Vercel dashboard (Deployments → ⋯ → Promote to Production), then fix forward in a new PR.

### CI passes but Vercel Preview build fails

Almost always an env var difference. Check that the failing step in Vercel logs references a missing variable, then add it under **Settings → Environment Variables** with the correct scope.

### Neon shows high storage on staging DB

Truncate non-essential tables in `indlokal-db-staging` periodically. It's a sandbox; you can also recreate the DB and re-run migrations from a fresh PR.

### A secret leaked

1. Rotate at the source (Neon, Resend, etc.).
2. Update Vercel env vars and GitHub secrets.
3. Redeploy from the Vercel dashboard to pick up the new value.

---

## 10. What is intentionally not in this setup

These are valid decisions to revisit later, but adding them now would create complexity without proportional benefit:

- ❌ Tag-driven releases (`v1.2.0`) — adds ceremony for a one-developer MVP.
- ❌ Neon database branching per PR — useful at multi-developer scale; one shared staging DB is fine for MVP.
- ❌ A separate GitHub Actions workflow that runs `prisma migrate deploy` against Neon — Vercel already does this atomically inside the deploy.
- ❌ GitHub Environment approval gates on production — add when there is more than one developer or external paying users.
- ❌ Vercel Pro, Sentry, custom build machines — add when free tier hurts or external users demand SLAs.

When any of these become real needs, document them in [operations.md](operations.md) before adding them.

---

## 11. Files this setup touches

| File                                                              | Purpose                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`apps/web/package.json`](../../apps/web/package.json)            | Defines the `build:vercel` script Vercel runs.                                                   |
| [`apps/web/prisma/migrations/`](../../apps/web/prisma/migrations) | All committed schema changes.                                                                    |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)      | Code validation only — typecheck, lint, test, build, migration apply against ephemeral Postgres. |
| [`.github/workflows/cron.yml`](../../.github/workflows/cron.yml)  | Scheduled jobs hitting `/api/cron/*` with `CRON_SECRET`.                                         |

There is intentionally no `vercel.json`. All Vercel config is in the dashboard, where it belongs for a single-app deployment.
