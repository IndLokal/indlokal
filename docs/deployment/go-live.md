# MVP Go-Live Runbook

> **First-time setup?** Follow [SETUP.md](SETUP.md) instead. This file is a condensed runbook covering accounts, mobile, custom domain, launch checklist, and upgrade triggers.

Use this when IndLokal needs a real backend URL, a web surface for partners, and a mobile app path for member recall.

## 1. Accounts

Create only what is needed:

| Service                     | Plan                                            | Required now?                |
| --------------------------- | ----------------------------------------------- | ---------------------------- |
| Vercel                      | Hobby/free while internal or non-commercial MVP | yes                          |
| Neon                        | Free                                            | yes                          |
| Expo                        | Free/EAS pay-as-needed                          | yes                          |
| Apple Developer             | Paid annually                                   | yes for iOS store/TestFlight |
| Google Play Console         | One-time fee                                    | yes for Android store        |
| Resend                      | Free                                            | only if sending real emails  |
| PostHog EU                  | Free                                            | optional                     |
| Cloudflare or registrar DNS | Free/at-cost                                    | only for custom domain       |

Use Vercel Pro and Neon paid plans only when the app is publicly/commercially launched or usage makes the free tiers painful.

## 2. Database

Detailed steps live in [SETUP.md §4](SETUP.md#4-vercel-storage--create-both-neon-databases). Summary:

1. Create both databases from **Vercel → Storage → Create Database → Neon** (no need to visit the Neon console). Pick an EU region (e.g. Frankfurt).
   - `indlokal-db` (production)
   - `indlokal-db-staging` (staging/preview)
2. In each database's "Connect Project" modal use env var prefix `DATABASE`:
   - `indlokal-db` → Production scope only
   - `indlokal-db-staging` → Preview scope only
3. Leave **Create Database Branch For Deployment** unchecked. All previews share `indlokal-db-staging`.
4. Keep a local dev database through Docker, as documented in the root [README.md](../../README.md).

Migrations are applied automatically by `pnpm run build:vercel` during each Vercel deployment, against that deployment's `DATABASE_URL`.

For the first MVP seed only:

```bash
DATABASE_URL='<neon-url>' pnpm --filter web db:seed
```

## 3. Vercel

Detailed steps live in [SETUP.md §3, §5](SETUP.md#3-vercel--create-the-project). Summary:

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run build:vercel`
- Output Directory: empty (Next.js default)
- Include files outside the root directory in the Build Step: enabled
- Node.js Version: 20.x
- Production Branch: `main`

Use `apps/web` exactly for the Vercel Root Directory. Do not use `web` there. `web` is only the pnpm workspace name for commands such as `pnpm --filter web`.

Minimum env vars in Vercel:

| Key                    | Value                                     |
| ---------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_APP_URL`  | Vercel URL or custom domain               |
| `NEXT_PUBLIC_APP_NAME` | `IndLokal`                                |
| `CRON_SECRET`          | random string from `openssl rand -hex 32` |

Add these only when the features are active:

| Key                                                    | Needed for           |
| ------------------------------------------------------ | -------------------- |
| `RESEND_API_KEY`                                       | real outbound email  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`            | Google sign-in       |
| `OPENAI_API_KEY`                                       | AI pipeline          |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | analytics            |
| `EVENTBRITE_API_KEY`                                   | Eventbrite ingestion |
| `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_ID`                 | Google CSE ingestion |

`DATABASE_URL` is supplied by Vercel Storage when you create both databases with the `DATABASE` prefix — do not set it manually.

## 4. GitHub Actions

Set these repository secrets:

| Secret        | Value                                          | Used by       |
| ------------- | ---------------------------------------------- | ------------- |
| `APP_URL`     | production base URL e.g. `https://indlokal.de` | cron workflow |
| `CRON_SECRET` | same value as `CRON_SECRET` in Vercel          | cron workflow |

The CI workflow only validates code (typecheck, lint, test, build) against an ephemeral Postgres container. It does not write to any Neon database. Prisma migrations run inside the Vercel deployment for the connected environment, which keeps schema changes aligned with the exact Preview or Production deployment being built.

The cron workflow can run on schedule or manually. If AI costs become noisy, disable scheduled pipeline runs and use manual workflow dispatch.

Release flow:

1. Open a PR to `main` → GitHub Actions runs quality → tests → build, and Vercel builds a Preview against `indlokal-db-staging`.
2. Verify the Preview URL.
3. Merge to `main` → Vercel runs `pnpm run build:vercel`, applies Prisma migrations against `indlokal-db`, and deploys to production.
4. Done.

## 5. Mobile app

Mobile is part of the MVP because members need recall beyond a browser tab. The web app remains the backend/API surface; do not create a separate mobile backend.

Set the production API base URL for EAS builds:

```bash
cd apps/mobile
pnpm dlx eas-cli secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://indlokal.com
```

Use Vercel preview URLs only for founder testing. Store/TestFlight builds should point at the production web deployment.

Build the first internal mobile releases:

```bash
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli build --profile preview --platform ios
pnpm dlx eas-cli build --profile preview --platform android
```

Move to production builds when the same backend is ready to share with real members:

```bash
cd apps/mobile
pnpm dlx eas-cli build --profile production --platform ios
pnpm dlx eas-cli build --profile production --platform android
```

Keep the first release narrow:

- Browse city feed, events, communities, and resources.
- Sign in only if the auth path is stable.
- Push notification pre-prompt can exist, but real push campaigns should wait until members are actively saving/following/RSVPing.
- Do not block launch on every ingestion or admin feature.

## 6. Custom domain

Skip this for internal demos. Use the Vercel preview URL.

When public:

1. Buy `indlokal.de` or use the chosen domain.
2. Add the domain in Vercel.
3. Add the DNS records Vercel asks for at the registrar or Cloudflare.
4. Update `NEXT_PUBLIC_APP_URL` to the final HTTPS URL.
5. Update Google OAuth redirect URI if sign-in is enabled.

## 7. Launch check

Before sharing the link:

- [ ] Vercel deployment is green.
- [ ] `pnpm check` passes locally or in CI.
- [ ] `pnpm build` passes in CI.
- [ ] Home page loads.
- [ ] `/stuttgart` loads with seeded content.
- [ ] `EXPO_PUBLIC_API_BASE_URL` points to the production web URL for EAS builds.
- [ ] iOS preview build opens and loads production content.
- [ ] Android preview build opens and loads production content.
- [ ] Sign-in works if enabled.
- [ ] Email works if enabled.
- [ ] One cron job can be triggered manually if cron is enabled.
- [ ] `DATABASE_URL` is not present in checked-in files.

## 8. Upgrade triggers

Move beyond this MVP setup only when one of these is true:

| Trigger                                       | Upgrade                                   |
| --------------------------------------------- | ----------------------------------------- |
| Public/commercial launch                      | Vercel Pro                                |
| Neon cold starts annoy demos or users         | Neon paid plan                            |
| Users report errors and logs are insufficient | Add Sentry                                |
| Cron freshness matters to users               | Use Vercel Cron or a dedicated scheduler  |
| Mobile preview builds validate member recall  | Submit to TestFlight / Play internal      |
| Store review blocks launch repeatedly         | Add a tiny mobile release checklist owner |
