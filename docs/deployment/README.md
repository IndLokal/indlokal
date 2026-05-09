# IndLokal Deployment

This folder is the deployment source of truth for the current MVP stage.

**👉 Setting up from scratch?** Follow [SETUP.md](SETUP.md) end-to-end. It is the single, authoritative setup document.

The goal is **simple but workable**: get the web backend online, ship the mobile app path needed for member recall, keep founder workload low, avoid paid infrastructure until there is real external usage, and make the upgrade path obvious when the product starts getting traction.

Current release model:

- `main` is the production branch — every merge deploys to production via Vercel
- feature branches and PRs produce Vercel Preview deployments that share the `indlokal-db-staging` database

## Current stage

IndLokal is still being built. The deployment plan should support:

- founder demos
- early city content validation
- mobile-first member recall
- preview links for review
- a low-risk public MVP when ready

It should not create a mature production platform before the product needs one.

## MVP architecture

```text
Members / founders
      |
      +--> Expo mobile app
      |    apps/mobile (iOS + Android)
      |
      +--> Vercel web app
           apps/web (Next.js + API)
                |
                v
           Neon Postgres

Optional:
- Resend for real emails
- PostHog for analytics
- GitHub Actions for scheduled cron calls
- Cloudflare / registrar DNS for a custom domain
```

## Default choices

| Concern        | MVP default                                      | Upgrade when                                                           |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Web hosting    | Vercel, free/hobby while non-commercial/internal | Public/commercial launch or Vercel limits hit                          |
| Database       | Neon free tier                                   | Cold starts hurt demos, storage approaches limit, or paid users arrive |
| Email          | Console logging in dev; Resend free when needed  | Email volume or deliverability requires it                             |
| Analytics      | PostHog optional                                 | We need funnel data, not just page views                               |
| Error tracking | Vercel logs first                                | External users report issues repeatedly                                |
| Cron           | GitHub Actions or manual runs                    | Jobs become user-visible or reliability matters                        |
| Mobile         | Expo EAS internal builds, then store release     | Partner/member testing needs easier recall than a browser link         |

## Files in this folder

- [SETUP.md](SETUP.md) — **start here** — end-to-end setup of Vercel + Neon + GitHub Actions
- [go-live.md](go-live.md) — condensed launch runbook (web + mobile)
- [operations.md](operations.md) — ongoing ops checklist
- [mobile.md](mobile.md) — Expo/EAS release notes

## What we are intentionally not doing yet

- No Kubernetes
- No Docker production path
- No always-on separate app stack beyond Vercel preview plus production
- No Terraform
- No separate worker service
- No Redis or queue
- No Sentry requirement on day 1
- No Vercel Pro requirement until public/commercial launch
- No detailed GDPR operating program until external users are real
- No separate mobile backend
- No custom mobile CI/CD before app-store traction

Keep this boring. A founder should be able to understand the whole setup in 10 minutes.
