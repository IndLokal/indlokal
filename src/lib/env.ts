/**
 * Runtime environment validation — import this in the root layout to fail fast
 * if critical environment variables are missing in production.
 */

const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return value;
}

function requireEnvInProduction(name: string): string | undefined {
  const value = process.env[name];
  if (isProduction && !value) {
    throw new Error(`[env] Missing required environment variable in production: ${name}`);
  }
  return value;
}

// Always required
requireEnv('DATABASE_URL');

// Required in production
requireEnvInProduction('NEXT_PUBLIC_APP_URL');
requireEnvInProduction('GOOGLE_CLIENT_ID');
requireEnvInProduction('GOOGLE_CLIENT_SECRET');
requireEnvInProduction('RESEND_API_KEY');

// Validate NEXT_PUBLIC_APP_URL is not localhost in production
if (isProduction) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
    throw new Error(
      `[env] NEXT_PUBLIC_APP_URL must not point to localhost in production: ${appUrl}`,
    );
  }
}

export {};
