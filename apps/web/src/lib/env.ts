/**
 * Runtime environment validation — call validateEnv() in the root layout to
 * fail fast if critical environment variables are missing in production.
 *
 * All checks are deferred to a function so they run at server startup, NOT
 * during `next build` static generation (which also uses NODE_ENV=production).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return value;
}

function requireEnvInProduction(name: string): string | undefined {
  const value = process.env[name];
  if (process.env.NODE_ENV === 'production' && !value) {
    throw new Error(`[env] Missing required environment variable in production: ${name}`);
  }
  return value;
}

let validated = false;

export function validateEnv() {
  if (validated) return;
  // Skip during `next build` static generation — env secrets aren't available
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  validated = true;

  // Always required
  requireEnv('DATABASE_URL');

  // Required in production
  requireEnvInProduction('NEXT_PUBLIC_APP_URL');
  requireEnvInProduction('GOOGLE_CLIENT_ID');
  requireEnvInProduction('GOOGLE_CLIENT_SECRET');
  requireEnvInProduction('RESEND_API_KEY');
  // Upload storage (S3 / R2) — required in production
  requireEnvInProduction('UPLOAD_BUCKET');
  requireEnvInProduction('UPLOAD_ACCESS_KEY_ID');
  requireEnvInProduction('UPLOAD_SECRET_ACCESS_KEY');

  // Validate NEXT_PUBLIC_APP_URL is not localhost in production
  if (process.env.NODE_ENV === 'production') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
      throw new Error(
        `[env] NEXT_PUBLIC_APP_URL must not point to localhost in production: ${appUrl}`,
      );
    }
  }
}
