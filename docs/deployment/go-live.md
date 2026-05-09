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

1. Create a single Neon project in an EU region (e.g. `eu-central-1`).
2. Inside that project, create **two databases**:
   - `indlokal-db` — production
   - `indlokal-db-staging` — staging / preview
3. For each database, copy the **pooled** connection string (Neon dashboard → Connection Details → Pooled connection).
4. Store `indlokal-db-staging` pooled URL as the Vercel **Preview** `DATABASE_URL`.
5. Store `indlokal-db` pooled URL as the Vercel **Production** `DATABASE_URL`.
6. Store `indlokal-db-staging` pooled URL as the GitHub Actions secret `STAGING_DATABASE_URL`.
7. Store `indlokal-db` pooled URL as the GitHub Actions secret `DATABASE_URL`.
8. Keep a local dev database through Docker, as already documented in the root [README.md](../../README.md).

> **Why two databases, not Neon branches?** Neon branches are useful for per-PR isolation but require automation. Two plain databases map cleanly to two Vercel environment scopes with zero tooling overhead — right for MVP stage.

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
4. Leave the **Production Branch** as `main` (Vercel default). Every push to `main` deploys to production. Every PR/branch gets a Preview deployment backed by `indlokal-db-staging`.
5. Add the minimum env vars, setting each under the correct **Environment** scope (Preview vs Production) in Vercel:
   - `DATABASE_URL` → set **separately** for Preview (`indlokal-db-staging` URL) and Production (`indlokal-db` URL)
   - All other keys below can be shared across environments unless the values differ:

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

> **Vercel environment scope reminder:** `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` must be set as separate values per environment (Preview and Production). All other keys can use the same value across environments unless you have a reason to split them.

## 4. GitHub Actions

Set these repository secrets:

| Secret                 | Value                                          | Used by                        |
| ---------------------- | ---------------------------------------------- | ------------------------------ |
| `DATABASE_URL`         | `indlokal-db` Neon pooled URL                  | production migration job in CI |
| `STAGING_DATABASE_URL` | `indlokal-db-staging` Neon pooled URL          | staging migration job in CI    |
| `APP_URL`              | production base URL e.g. `https://indlokal.de` | cron workflow                  |
| `CRON_SECRET`          | same value as `CRON_SECRET` in Vercel          | cron workflow                  |

The cron workflow can run on schedule or manually. If AI costs become noisy, disable scheduled pipeline runs and use manual workflow dispatch.

Release flow:

1. Merge a PR to `main`.
2. CI runs quality → tests → build → migrations automatically.
3. Vercel deploys to production automatically.
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
