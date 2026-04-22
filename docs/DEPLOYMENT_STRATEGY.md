# IndLokal Deployment Strategy

**Goal:** keep production reliable with as little manual effort as possible.

This platform should be deployed as a **managed monolith**:

- **Frontend + API:** Vercel
- **Database:** managed PostgreSQL (Neon or Supabase)
- **Email:** Resend
- **Analytics:** PostHog Cloud
- **DNS:** Cloudflare or registrar DNS
- **Scheduled jobs:** HTTP cron jobs calling existing `/api/cron/*` routes

Do not introduce Kubernetes, separate workers, Redis, or a queue in the first production setup. The codebase does not need them yet.

---

## 1. Recommended Production Architecture

```text
Users / Google
      |
      v
  indlokal.de
      |
      v
   Vercel
  Next.js app
  - public pages
  - admin pages
  - API routes
  - cron endpoints
      |
      +----------------------------+
      |                            |
      v                            v
Managed Postgres              External services
Neon or Supabase              - Resend
Prisma                        - PostHog
                              - Google OAuth
                              - OpenAI
                              - Eventbrite
                              - Google CSE

Scheduler
GitHub Actions or EasyCron
      |
      v
POST /api/cron/* with CRON_SECRET
```

### Why this is the right default

- The app is already a Next.js 16 monolith with API routes.
- Prisma + PostgreSQL fits managed DB hosting cleanly.
- Cron entry points already exist in the app, so there is no need for a separate worker service on day one.
- Most operational complexity can be outsourced to managed vendors.

---

## 2. Deployment Principles

### Keep the web app and API together

Run the public site, admin, auth callbacks, and internal cron endpoints in the same Vercel project.

### Keep state outside the app runtime

Anything persistent must live in Postgres or external managed services. Vercel instances are ephemeral.

### Use push-button deploys only

- `main` deploys to production automatically
- pull requests deploy preview environments automatically
- database schema changes run through Prisma migrations

### Prefer scheduled HTTP jobs over infrastructure

The repository already exposes authenticated cron routes. Use them first. Only add a separate worker when runtime limits or cost make that necessary.

---

## 3. Environment Strategy

Use three environments only.

| Environment | Purpose       | Hosting                                         |
| ----------- | ------------- | ----------------------------------------------- |
| Local       | Development   | Docker Postgres + Next.js dev server            |
| Preview     | PR validation | Vercel preview + shared preview DB or branch DB |
| Production  | Real traffic  | Vercel production + managed Postgres            |

### Recommendation

- Use **one production database**.
- Use **one preview database strategy**:
  - simplest: one shared non-production DB
  - better: provider branch databases if Neon is used
- Do not create a separate staging environment yet unless the team starts shipping risky changes frequently.

---

## 4. Managed Services Choice

### Option A: simplest overall

- **Vercel** for app hosting
- **Neon** for Postgres
- **Resend** for email
- **PostHog Cloud EU** for analytics

This is the cleanest fit for a Next.js + Prisma app with low ops overhead.

### Option B: acceptable alternative

- **Vercel** for app hosting
- **Supabase Postgres** for database
- **Resend** for email
- **PostHog Cloud EU** for analytics

Pick this if you want a more bundled dashboard around the database. Do not adopt Supabase Auth here unless you intentionally want to replace the current Google auth approach.

### Recommendation

Choose **Vercel + Neon + Resend + PostHog**.

---

## 5. Production Runtime Requirements

The app needs these secrets in production:

### Required

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `CRON_SECRET`

### Required for the AI ingestion pipeline

- `OPENAI_API_KEY`
- `PIPELINE_LLM_MODEL` (optional override)
- `EVENTBRITE_API_KEY` (optional but useful)
- `GOOGLE_CSE_API_KEY` (optional)
- `GOOGLE_CSE_ID` (optional)

### Optional

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

### Rules

- Production secrets live only in the hosting platform secret manager.
- Never keep production secrets in checked-in files.
- Use separate secrets for preview and production.

---

## 6. CI/CD Strategy

Keep CI/CD minimal.

### Source control flow

- Developers open PRs against `main`
- Vercel creates a preview deployment automatically
- CI runs validation checks
- Merging to `main` deploys production automatically

### CI checks

Run these on every PR:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

### Database deployment

Use Prisma migrations, not `prisma db push`, in production.

Production release flow:

1. Merge PR to `main`
2. CI or release hook runs `prisma migrate deploy`
3. Vercel deploys the new app version

### Recommendation

Use **GitHub Actions** for validation and migrations. Let **Vercel** handle the actual app deployment.

---

## 7. Cron and Background Jobs

The repository already has secured cron endpoints and that should remain the primary background-job strategy for now.

### Existing endpoints

- `/api/cron/pipeline`
- `/api/cron/scores`
- `/api/cron/links`
- `/api/cron/keywords`
- `/api/cron/relationships`
- `/api/cron/enrichment`

Each route already expects:

- `Authorization: Bearer <CRON_SECRET>`

### Recommended scheduler

Use one of these:

1. **GitHub Actions scheduled workflows** calling the cron URLs
2. **EasyCron** or similar external cron service
3. **Vercel Cron** only if custom headers or auth handling is compatible with your setup

### Recommended schedule

| Job             | Frequency     | Reason                                               |
| --------------- | ------------- | ---------------------------------------------------- |
| `pipeline`      | every 6 hours | keep discovery data fresh without excessive LLM cost |
| `scores`        | every 2 hours | refresh rankings and archive past events             |
| `links`         | daily         | verify join links and websites                       |
| `keywords`      | daily         | improve search terms slowly                          |
| `relationships` | daily         | refresh graph-like related community data            |
| `enrichment`    | daily         | fill sparse community metadata                       |

### Important constraint

The pipeline route allows up to 5 minutes. If real production runs start exceeding that consistently, move only the pipeline job to a dedicated worker runtime such as Railway or Google Cloud Run. Keep the main app on Vercel.

---

## 8. Database Strategy

### Production database

- Managed Postgres with automated backups enabled
- Connection pooling enabled if recommended by the provider
- Prisma migrations used for all schema changes

### Backup policy

- Daily automated backups retained for at least 7 to 14 days
- One manual backup before any risky schema migration

### Restore policy

- Test one restore into a non-production environment before launch
- Document who can perform restore and how long it takes

### Recommendation

For MVP, **one primary Postgres instance with managed backups is enough**. Do not add replicas until read load or restore requirements justify them.

---

## 9. Observability and Alerting

Keep observability lightweight but real.

### Minimum setup

- Vercel deployment logs
- Provider database metrics and alerts
- PostHog for product behavior
- Error notifications from Vercel or Sentry

### Recommendation

Add **Sentry** once production traffic starts, but do not block launch on it. Before that, rely on Vercel logs and database monitoring.

### What to alert on

- Production deploy failure
- Cron endpoint returning non-200 repeatedly
- Database storage or connection thresholds
- Error-rate spike on production routes

---

## 10. Security and Access Model

### Keep it simple

- Production uses HTTPS only
- Domain is fronted by Vercel
- Cron endpoints require `CRON_SECRET`
- Admin access continues to use app-level auth

### Operational rules

- Only a small number of maintainers get production access
- Separate preview and production secrets
- Rotate `CRON_SECRET`, OAuth secrets, and API keys if compromised
- Restrict database access to trusted maintainers only

---

## 11. Cost-Conscious MVP Setup

For the first real launch, aim for this shape:

- Vercel Pro or equivalent
- Neon Launch or equivalent managed Postgres plan
- Resend free or low-tier paid plan
- PostHog free tier initially
- GitHub Actions for scheduled cron calls

This should keep operations simple and cost proportional to actual usage.

---

## 12. What Not To Build Yet

Avoid these until the platform proves the need:

- Kubernetes
- microservices
- Redis cache layer
- message queue
- separate ingestion service
- multi-region deployment
- read replicas
- dedicated search cluster
- infrastructure-as-code for every vendor detail

These all add maintenance burden before they solve a real problem here.

---

## 13. When To Evolve The Architecture

Change the architecture only when a specific constraint appears.

| Trigger                                                | Change                                            |
| ------------------------------------------------------ | ------------------------------------------------- |
| Pipeline jobs regularly exceed Vercel limits           | Move pipeline only to Cloud Run or Railway worker |
| Search becomes slow or fuzzy matching becomes critical | Add Meilisearch or Algolia                        |
| Production errors need deeper tracing                  | Add Sentry                                        |
| Heavy read load on city feeds                          | Add caching layer or read replica                 |
| Team size and release complexity increase              | Add a true staging environment                    |

---

## 14. Recommended Launch Sequence

1. Create production domain and Vercel project.
2. Create managed Postgres instance.
3. Set all production secrets.
4. Configure Google OAuth production callback URL.
5. Configure Resend sending domain.
6. Run Prisma migrations on production DB.
7. Seed minimum launch-city data.
8. Deploy from `main`.
9. Configure scheduled cron calls for `/api/cron/*`.
10. Verify logs, email, auth, and one full cron cycle.

---

## 15. Final Recommendation

For this codebase, the simplest correct production setup is:

- **Vercel** for the Next.js monolith
- **Neon Postgres** for the database
- **GitHub Actions scheduled workflows** for cron calls
- **Resend** for transactional email
- **PostHog Cloud** for analytics

That gives you:

- automatic preview deploys
- automatic production deploys
- no server management
- no manual cron execution
- low operational overhead
- a clean upgrade path if the AI pipeline outgrows serverless limits

Anything more complex than that is premature for the current platform.
