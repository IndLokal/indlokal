/**
 * GET /auth/google/callback — complete the web Google OAuth flow.
 *
 * Validates the CSRF `state`, exchanges the authorization code server-side
 * (using the PKCE verifier), upserts/links the User via the shared
 * `@/lib/auth/google` helpers (same logic as mobile), then establishes a
 * secure HttpOnly cookie session and redirects to `/me`.
 *
 * Normal login only authenticates the user — no roles or community authority
 * are granted here. Authorization stays controlled by RoleAssignment /
 * CommunityCollaborator and is enforced server-side on protected routes.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateSessionToken,
  persistSessionInDb,
  setSessionCookieOnResponse,
} from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import {
  GoogleAuthError,
  exchangeGoogleCode,
  fetchGoogleProfile,
  upsertGoogleUser,
} from '@/lib/auth/google';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  googleCallbackUrl,
} from '@/lib/auth/google-oauth-web';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? '';
  const codeVerifier = jar.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value ?? '';
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE);
  jar.delete(GOOGLE_OAUTH_VERIFIER_COOKIE);

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/me/login?error=${reason}`, request.url));

  const params = request.nextUrl.searchParams;
  if (params.get('error')) {
    // User declined consent or Google returned an error — go back gracefully.
    return fail('google');
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    console.error('[auth/google/callback] invalid oauth state');
    return fail('google');
  }

  try {
    const accessToken = await exchangeGoogleCode({
      code,
      redirectUri: googleCallbackUrl(request.url),
      codeVerifier,
    });
    const profile = await fetchGoogleProfile(accessToken);
    const { user, isNewUser } = await upsertGoogleUser(profile);

    const sessionToken = generateSessionToken();
    await persistSessionInDb(user.id, sessionToken);

    const response = NextResponse.redirect(new URL('/me', request.url));
    setSessionCookieOnResponse(response, sessionToken);

    void captureServerEvent(user.id, isNewUser ? Events.USER_SIGNED_UP : Events.USER_LOGGED_IN, {
      login_surface: 'web',
      auth_method: 'google',
    });

    // Web users land on /me where incomplete onboarding is surfaced
    // prominently until profile preferences are saved.
    return response;
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      console.error('[auth/google/callback] failed', {
        reason: err.reason,
        providerError: err.providerError,
      });
      return fail('google');
    }
    console.error('[auth/google/callback] unexpected error');
    return fail('google');
  }
}
