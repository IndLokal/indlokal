# MVP Operations

This is intentionally small. If a founder cannot do it in a few minutes, it is too much process for the current stage.

## Weekly

- Check the latest Vercel production deployment for `main`.
- Check Neon storage and connection errors for `indlokal-db` and `indlokal-db-staging`.
- Check GitHub Actions CI failures.
- Check the latest EAS preview/production build status when a mobile build is active.
- Check OpenAI usage if `OPENAI_API_KEY` is enabled.

## Before changing database schema

1. Create and commit a Prisma migration locally (`pnpm --filter web exec prisma migrate dev --name <name>`).
2. Run tests locally.
3. Open a PR — CI runs against ephemeral Postgres (and validates the migration applies cleanly), and the Vercel Preview deployment applies the migration to `indlokal-db-staging`.
4. Click the Preview deployment and verify the feature against the migrated staging database.
5. Merge to `main` — Vercel applies the same migration to `indlokal-db` and deploys the app.

Do not use `prisma db push` against production or staging.

## Production release

Merge to `main`. GitHub Actions validates the code, and Vercel handles the environment-specific migration plus deploy.

## If deploy fails

1. Open Vercel deployment logs.
2. If the deploy failed, fix in a PR, merge to `main` again.
3. If runtime broke, promote the previous green Vercel deployment from the Vercel dashboard.
4. If a migration caused it, stop and inspect the migration before touching production data.

## If cron fails

1. Open GitHub Actions → Cron Jobs.
2. Re-run the failed workflow.
3. If it fails again, copy the JSON error from the workflow log and debug the matching route under `apps/web/src/app/api/cron`.

## If a mobile build fails

1. Open the EAS build log.
2. Confirm `EXPO_PUBLIC_API_BASE_URL` is set for the project.
3. Run `pnpm --filter mobile typecheck` locally.
4. Re-run the same EAS profile after the fix.

## If a secret leaks

1. Rotate it at the source vendor.
2. Update Vercel environment variables.
3. Update GitHub Actions secrets if used there.
4. Redeploy Vercel.

## Minimum access rules

- At least one founder owns GitHub, Vercel, Neon, Expo, Apple Developer, Google Play Console, and the domain account.
- Before public launch, add a second founder/admin to those same accounts where the vendor allows it.
- Production secrets stay in Vercel/GitHub secret stores, not in markdown or `.env` files.

## Public launch basics

When external users arrive, add the boring legal/compliance basics:

- `/privacy`
- `/impressum`
- cookie/analytics consent if analytics cookies are used
- a support email address
- app privacy labels for iOS and Android

Do not build a full compliance program before there are real users.
