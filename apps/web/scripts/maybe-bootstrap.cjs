#!/usr/bin/env node
/**
 * Conditional bootstrap shim invoked from `build:vercel`.
 *
 * Runs the bootstrap seed only when RUN_BOOTSTRAP_SEED=true. Intended to be
 * safe to leave on in Vercel env (bootstrap is fully idempotent), but defaults
 * to off so that builds without DB credentials (e.g. PR previews from forks)
 * never fail.
 *
 * Set DATABASE_URL + RUN_BOOTSTRAP_SEED=true in Vercel Project → Environment
 * Variables to enable.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.env.RUN_BOOTSTRAP_SEED !== 'true') {
  console.log('↷ Skipping bootstrap seed (RUN_BOOTSTRAP_SEED != "true").');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.warn('⚠ RUN_BOOTSTRAP_SEED=true but DATABASE_URL is not set — skipping.');
  process.exit(0);
}

const tsxBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
const result = spawnSync(tsxBin, ['prisma/bootstrap.ts'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
});

if (result.status !== 0) {
  console.error('❌ Bootstrap seed failed; aborting build.');
  process.exit(result.status || 1);
}
