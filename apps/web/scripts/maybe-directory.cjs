#!/usr/bin/env node
/**
 * Conditional directory-seed shim invoked from `build:vercel`.
 *
 * Runs the directory seed only when RUN_DIRECTORY_SEED=true. The seed itself
 * is create-only and idempotent (existing community rows are NEVER updated),
 * so leaving the flag enabled in Vercel env is safe and recommended.
 *
 * Defaults to off so that builds without DB credentials (PR previews from
 * forks, etc.) never fail.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.env.RUN_DIRECTORY_SEED !== 'true') {
  console.log('↷ Skipping directory seed (RUN_DIRECTORY_SEED != "true").');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.warn('⚠ RUN_DIRECTORY_SEED=true but DATABASE_URL is not set — skipping.');
  process.exit(0);
}

const tsxBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
const result = spawnSync(tsxBin, ['prisma/directory.ts'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
});

if (result.status !== 0) {
  console.error('❌ Directory seed failed; aborting build.');
  process.exit(result.status || 1);
}
