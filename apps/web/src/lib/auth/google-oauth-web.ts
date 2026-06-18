/**
 * Server-only helpers for the web (cookie-session) Google OAuth flow.
 *
 * Shared between `/auth/google/start` and `/auth/google/callback` so the
 * redirect URI, cookie names, and PKCE handling stay in lockstep. The actual
 * code exchange + user upsert is delegated to `@/lib/auth/google` (the same
 * logic the mobile `/api/v1/auth/google` route uses) so both surfaces link the
 * same User. Web persists a secure HttpOnly cookie session — no tokens in the
 * browser.
 */

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE = 'google_oauth_verifier';
/** Short-lived: the round trip to Google and back should take seconds. */
export const GOOGLE_OAUTH_TX_MAX_AGE = 10 * 60;

/**
 * The redirect URI registered with Google. Prefer the canonical app URL so it
 * matches the value configured in the Google console; fall back to the request
 * origin in local/preview environments where NEXT_PUBLIC_APP_URL is unset.
 */
export function googleCallbackUrl(requestUrl: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(requestUrl).origin;
  return new URL('/auth/google/callback', base).toString();
}

/** Authorization endpoint URL with PKCE + state. */
export function googleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Random URL-safe token used for both the OAuth state and the PKCE verifier. */
export function randomUrlToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** PKCE S256 challenge = base64url(SHA-256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function oauthTxCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/auth/google',
    maxAge: GOOGLE_OAUTH_TX_MAX_AGE,
  };
}
