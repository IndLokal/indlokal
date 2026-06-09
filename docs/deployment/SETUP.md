# IndLokal - End-to-End Deployment Setup

This is the **single source of truth** for setting up IndLokal's web deployment chain.

> Audience: someone setting this up from scratch (or repairing it).
> Time: ~30-45 minutes if accounts already exist.

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
│ GitHub Actions CI  │         │ Vercel - apps/web (Next.js)    │
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

**Key principle:** Prisma migrations run **inside the Vercel build** against that deployment's `DATABASE_URL` (Preview -> staging DB, Production -> production DB). If migration fails, deployment fails.

GitHub Actions only validates code and migrations against ephemeral Postgres; it does not write to Neon.

---

## 2. Prerequisites

Accounts you need:

| Service          | Plan needed for MVP    | How to create                                                        |
| ---------------- | ---------------------- | -------------------------------------------------------------------- |
| GitHub           | repo access            | already have it                                                      |
| Vercel           | Hobby (free)           | sign up at [vercel.com](https://vercel.com) - login with GitHub      |
| Neon             | Free                   | **created from inside Vercel in step 4** - no separate signup needed |
| Domain registrar | only when going public | any registrar                                                        |

You should already have the `ind-lokal` repo and a Vercel account.
You do **not** need to visit [console.neon.tech](https://console.neon.tech) during initial setup.

---

## 3. Vercel - create the project

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → select the `ind-lokal` repo.
3. On the configuration screen:

| Setting                        | Value                                         |
| ------------------------------ | --------------------------------------------- |
| Framework Preset               | Next.js                                       |
| Root Directory                 | `apps/web`                                    |
| Build Command                  | `pnpm run build:vercel`                       |
| Install Command                | `pnpm install --frozen-lockfile`              |
| Output Directory               | _(leave empty - Vercel uses Next.js default)_ |
| Include files outside root dir | **Enabled** (required for `packages/shared`)  |
| Node.js Version                | `20.x`                                        |
| Production Branch              | `main` (default)                              |

Important: Vercel Root Directory must be `apps/web` (not `web`).

4. Add env vars in step 5 after database setup.
5. Click **Deploy**. The first deploy may fail due to missing `DATABASE_URL`; continue to step 4.

> The `build:vercel` script lives in [`apps/web/package.json`](../../apps/web/package.json) and runs:
> `prisma generate && prisma migrate deploy` (with retry) + optional `maybe-bootstrap` / `maybe-directory` seed shims + `next build --webpack`.

---

## 4. Vercel Storage - create both Neon databases

Create both databases from the Vercel dashboard (production + staging).

### 4.1 Create the production database

1. In your Vercel project → **Storage** tab → **Create Database** → choose **Neon - Serverless Postgres** → **Continue**.
2. Authorize the Neon integration the first time you use it (signs you up on Neon transparently).
3. In the create dialog:
   - **Database Name**: `indlokal-db`
   - **Region**: pick an EU region - `Frankfurt, Germany (eu-central-1)` recommended
   - **Plan**: Free
4. Click **Create**.
5. After creation, Vercel shows the "Connect Project" modal. Set:
   - **Environments**: ✅ Production only (uncheck Preview and Development)
   - **Create Database Branch For Deployment**: leave both unchecked
   - **Custom Environment Variable Prefix**: change `STORAGE` → `DATABASE`
   - **Sensitive**: leave on
6. Click **Connect**.

### 4.2 Create the staging database

1. Back in **Storage** → **Create Database** → **Neon - Serverless Postgres** → **Continue**.
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

### 4a. Optional - use the Neon console directly

Use [console.neon.tech](https://console.neon.tech) only when needed for:

- Inspecting tables / running ad-hoc SQL via the Neon SQL Editor
- Adjusting compute size or autoscaling
- Manually resetting the staging DB
- Recovering from `_prisma_migrations` problems (see [§9](#9-troubleshooting))

Open Vercel → **Storage** → database → **Open in Neon**.

---

## 5. Vercel - application environment variables

Add these in Vercel → **Settings → Environment Variables**. Apply to **All Environments** unless noted.

### Required for any deployment

| Key                    | Value                                                                                                                                                        | Scope          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `NEXT_PUBLIC_APP_NAME` | `IndLokal`                                                                                                                                                   | All            |
| `NEXT_PUBLIC_APP_URL`  | Production: your final URL (e.g. `https://indlokal.com`). Preview: leave the same or set per-env.                                                            | All (or split) |
| `CRON_SECRET`          | Output of `openssl rand -hex 32`                                                                                                                             | All            |
| `AUTH_JWT_PRIVATE_KEY` | RS256 PKCS#8 PEM. Generate with the snippet below. **Required** - without it every cold start mints a new ephemeral key and invalidates all mobile sessions. | All            |
| `AUTH_JWT_PUBLIC_KEY`  | Matching SPKI PEM for the private key above.                                                                                                                 | All            |
| `RUN_BOOTSTRAP_SEED`   | `true` - runs the idempotent bootstrap during build (cities, categories, personas, admin user).                                                              | All            |
| `RUN_DIRECTORY_SEED`   | `true` - runs the create-only directory + resources seed during build.                                                                                       | All            |

Generate the JWT keypair locally and paste both PEMs into Vercel (replace literal newlines with `\n` if the Vercel UI requires single-line values - the loader unescapes them):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

### Optional - add only when the feature is used

| Key                                                   | Needed for           |
| ----------------------------------------------------- | -------------------- |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                 | real outbound email  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`            | Google sign-in       |
| `OPENAI_API_KEY`                                      | AI pipeline          |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics            |
| `EVENTBRITE_API_KEY`                                  | Eventbrite ingestion |
| `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`                 | Google CSE ingestion |

### Discovery and pipeline config ownership (important)

Use this split:

1. **Provider/API credentials** are env vars in Vercel (this section):
   `OPENAI_API_KEY`, `EVENTBRITE_API_KEY`, `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`.
2. **Discovery coverage/source plan** (enabled regions, keyword seeds/strategies, pinned URLs) are **not env vars**. They are runtime DB rows in `pipeline_source_configs`, with `prisma/data/pipeline-source-defaults.json` as fallback baseline.

Where to configure discovery coverage/source plan:

- Update `apps/web/prisma/data/pipeline-source-defaults.json` in git.
- Apply/sync rows via:

```bash
pnpm --filter web pipeline:sources:sync
```

Use prune mode only when you intentionally want to disable DB rows missing
from defaults:

```bash
pnpm --filter web pipeline:sources:sync:prune
```

Where **not** to configure discovery coverage/source plan:

- Not in Vercel Environment Variables.
- Not in GitHub Actions secrets.
- Not in Expo/EAS mobile secrets.

> `DATABASE_URL` is **not** added manually. It comes from Vercel Storage (step 4).

---

## 6. GitHub Actions - repository secrets

Go to GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret        | Value                                             | Used by                                        |
| ------------- | ------------------------------------------------- | ---------------------------------------------- |
| `APP_URL`     | Your production URL (e.g. `https://indlokal.com`) | [`cron.yml`](../../.github/workflows/cron.yml) |
| `CRON_SECRET` | Same value as in Vercel (step 5)                  | [`cron.yml`](../../.github/workflows/cron.yml) |

That is the entire list. CI does **not** need database secrets.

### 6a. Protect `main` so CI must pass before deploy-triggering merges

Vercel and GitHub CI run in parallel on PR updates. Enforce branch protection on `main` so merges require CI success.

In GitHub: **Repo Settings → Branches → Add branch protection rule**

Use these settings:

| Setting                                          | Value                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Branch name pattern                              | `main`                                                                            |
| Require a pull request before merging            | ✅ enabled                                                                        |
| Require status checks to pass before merging     | ✅ enabled                                                                        |
| Required checks                                  | Select all checks from `CI` workflow (typically `Code quality`, `Tests`, `Build`) |
| Require branches to be up to date before merging | ✅ enabled                                                                        |
| Include administrators                           | ✅ enabled                                                                        |
| Allow force pushes                               | ❌ disabled                                                                       |
| Allow deletions                                  | ❌ disabled                                                                       |
| Restrict who can push to matching branches       | Optional but recommended: admins only                                             |

Result: production deploy-triggering merges to `main` require green CI.

---

## 7. First deployment - verify the chain

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

If it loads, staging DB wiring is correct.

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

This is the full default loop.

---

## 9. Troubleshooting

### Build fails with "P3005: The database schema is not empty"

The DB has tables but no `_prisma_migrations` table (often from `prisma db push`). Baseline it:

```bash
pnpm --filter web exec prisma migrate resolve --applied <migration_name>
```

Run against the affected `DATABASE_URL`.

### Preview URL works but shows old schema

The migration didn't run. Check the Vercel build logs for the deploy - look for the `prisma migrate deploy` step output. If it errored, fix the migration locally and push again.

### Production deploy succeeded but app errors on requests

A migration applied but runtime expects a different schema. Promote the previous green deployment, then fix forward in a new PR.

### CI passes but Vercel Preview build fails

Usually an env-var mismatch. Check Vercel logs for missing variables and add with correct scope.

### Neon shows high storage on staging DB

Truncate non-essential staging tables periodically, or recreate staging DB and rerun migrations.

### A secret leaked

1. Rotate at the source (Neon, Resend, etc.).
2. Update Vercel env vars and GitHub secrets.
3. Redeploy from the Vercel dashboard to pick up the new value.

---

## 10. What is intentionally not in this setup

Revisit later; currently unnecessary complexity:

- ❌ Tag-driven releases (`v1.2.0`) - adds ceremony for a one-developer MVP.
- ❌ Neon database branching per PR - useful at multi-developer scale; one shared staging DB is fine for MVP.
- ❌ A separate GitHub Actions workflow that runs `prisma migrate deploy` against Neon - Vercel already does this atomically inside the deploy.
- ❌ GitHub Environment approval gates on production - add when there is more than one developer or external paying users.
- ❌ Vercel Pro, Sentry, custom build machines - add when free tier hurts or external users demand SLAs.

When any of these become real needs, document them in [operations.md](operations.md) before adding them.

---

## 11. Files this setup touches

| File                                                              | Purpose                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`apps/web/package.json`](../../apps/web/package.json)            | Defines the `build:vercel` script Vercel runs.                                                   |
| [`apps/web/prisma/migrations/`](../../apps/web/prisma/migrations) | All committed schema changes.                                                                    |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)      | Code validation only - typecheck, lint, test, build, migration apply against ephemeral Postgres. |
| [`.github/workflows/cron.yml`](../../.github/workflows/cron.yml)  | Scheduled jobs hitting `/api/cron/*` with `CRON_SECRET`.                                         |

There is intentionally no `vercel.json`. All Vercel config is in the dashboard, where it belongs for a single-app deployment.
