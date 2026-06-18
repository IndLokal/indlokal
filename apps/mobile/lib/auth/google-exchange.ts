/**
 * Pure Google sign-in exchange (no Expo/React-Native imports) so it can be
 * unit-tested in Node. The Expo-coupled OAuth *request* hook lives in
 * `./google.ts`, which re-exports this for callers.
 *
 * Posts the authorization `code` to the backend (`/api/v1/auth/google`, the
 * source of truth), validates the `AuthTokens` envelope, and stores it in the
 * token store (SecureStore in the app).
 */

import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

type GoogleCodeInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Dev-only diagnostics for the Google flow. Logs ONLY non-sensitive context —
 * never the authorization code, tokens, id_token, client secret, or user data.
 */
export function logGoogleSignInDiagnostics(info: {
  redirectUri: string;
  apiBaseUrl: string;
  enabled: boolean;
}): void {
  if (!isDev()) return;
  console.log('[auth/google] starting exchange', {
    redirectUri: info.redirectUri,
    apiBaseUrl: info.apiBaseUrl,
    enabled: info.enabled,
  });
}

export async function signInWithGoogleCode(client: AuthClient, input: GoogleCodeInput) {
  const payload = auth.GoogleAuth.parse(input);
  try {
    const tokens = await client.postPublic<typeof payload, auth.AuthTokens>(
      '/api/v1/auth/google',
      payload,
    );
    const parsed = auth.AuthTokens.parse(tokens);
    await client.setTokens(parsed);
    return parsed;
  } catch (error) {
    if (isDev()) {
      // Safe: surface only the error message/name, never the code or tokens.
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error('[auth/google] backend exchange failed', { message });
    }
    throw error;
  }
}
