/**
 * GET /auth/google/start — begin the web (cookie-session) Google OAuth flow.
 *
 * Generates a CSRF `state` and a PKCE verifier, stashes both in short-lived
 * HttpOnly cookies, and redirects the browser to Google. The matching
 * `/auth/google/callback` route completes the exchange and establishes the
 * cookie session. This is the NORMAL user sign-in path — it never grants any
 * platform or community authority.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthConfig, GoogleAuthError } from '@/lib/auth/google';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  googleAuthorizeUrl,
  googleCallbackUrl,
  oauthTxCookieOptions,
  pkceChallenge,
  randomUrlToken,
} from '@/lib/auth/google-oauth-web';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let clientId: string;
  try {
    ({ clientId } = getGoogleOAuthConfig());
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      console.error('[auth/google/start] not configured', { reason: err.reason });
      return NextResponse.redirect(new URL('/me/login?error=google', request.url));
    }
    throw err;
  }

  const state = randomUrlToken();
  const codeVerifier = randomUrlToken();
  const codeChallenge = await pkceChallenge(codeVerifier);
  const redirectUri = googleCallbackUrl(request.url);

  const response = NextResponse.redirect(
    googleAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }),
  );
  const cookieOptions = oauthTxCookieOptions();
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);
  return response;
}
