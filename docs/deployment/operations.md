# MVP Operations

This is intentionally small. If a founder cannot do it in a few minutes, it is too much process for the current stage.

## Weekly

- Check the latest Vercel production deployment.
- Check Neon storage and connection errors.
- Check GitHub Actions failures.
- Check the latest EAS preview/production build status when a mobile build is active.
- Check OpenAI usage if `OPENAI_API_KEY` is enabled.

## Before changing database schema

1. Create and commit a Prisma migration locally.
2. Run tests.
3. Merge to `main`.
4. Let [../../.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) run `prisma migrate deploy`.

Do not use `prisma db push` against production.

## If deploy fails

1. Open Vercel deployment logs.
2. If build failed, fix in a PR and redeploy.
3. If runtime broke, promote the previous green Vercel deployment.
4. If a migration caused it, stop and inspect the migration before changing production data.

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
