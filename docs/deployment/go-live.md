# MVP Go-Live Runbook

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

1. Create a Neon project in an EU region.
2. Create both staging and production databases or branches.
3. Copy both pooled connection strings.
4. Store the staging connection string as Vercel Preview `DATABASE_URL`.
5. Store the production connection string as Vercel Production `DATABASE_URL`.
6. Keep a local dev database through Docker, as already documented in the root [README.md](../../README.md).

Production schema changes use migrations:

```bash
pnpm --filter web exec prisma migrate deploy
```

For the first MVP seed only:

```bash
DATABASE_URL='<neon-url>' pnpm --filter web db:seed
```

## 3. Vercel

1. Import the GitHub repo into Vercel.
2. Keep root directory as the repository root.
3. Let [../../vercel.json](../../vercel.json) provide install/build/output settings.
4. Set the Vercel Production Branch to a branch you do not use for normal merges, so pushes to `main` stay in Preview.
5. Treat `main` as the staging preview branch.
6. Add the minimum env vars:

| Key                    | Value                                     |
| ---------------------- | ----------------------------------------- |
| `DATABASE_URL`         | Neon pooled URL                           |
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

Use separate Vercel environment values for Preview and Production where the database or URLs differ.

## 4. GitHub Actions

Set these repository secrets if cron or migrations should run from GitHub:

| Secret                 | Used by                              |
| ---------------------- | ------------------------------------ |
| `STAGING_DATABASE_URL` | staging migration workflow on `main` |
| `DATABASE_URL`         | production release workflow          |
| `APP_URL`              | cron workflow                        |
| `CRON_SECRET`          | cron workflow                        |
| `VERCEL_TOKEN`         | manual production Vercel deploy      |
| `VERCEL_ORG_ID`        | manual production Vercel deploy      |
| `VERCEL_PROJECT_ID`    | manual production Vercel deploy      |

The current cron workflow is intentionally simple. It can run on schedule or manually. If AI costs become noisy, disable scheduled pipeline runs and use manual workflow dispatch.

Release flow:

1. Merge to `main` to get a staging preview deployment and staging DB migration.
2. Test the `main` preview URL.
3. Create a release tag like `v1.2.0` on the tested `main` commit.
4. Push the tag to trigger [../../.github/workflows/release-production.yml](../../.github/workflows/release-production.yml).
5. That workflow applies production migrations and performs the manual Vercel production deployment.

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
