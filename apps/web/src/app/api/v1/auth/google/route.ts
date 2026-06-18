/**
 * POST /api/v1/auth/google - TDD-0001 §3.
 *
 * Client (mobile or SPA) drives the OAuth dance, obtains an
 * authorization code, then posts it here. We exchange the code with
 * Google for an access token, derive the user, and return the standard
 * `AuthTokens` envelope.
 *
 * The Google code-exchange and user upsert logic lives in
 * `@/lib/auth/google` so the web cookie-session flow
 * (`/auth/google/start` + `/auth/google/callback`) links the SAME user
 * by the same rules. This route owns only the JWT envelope (mobile/SPA).
 *
 * NOTE: this replaces the legacy GET /api/auth/google + /callback pair,
 * which were deleted in the same PR per TDD-0001 §10.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { issueAccessToken } from '@/lib/auth/jwt';
import { issueRefreshToken } from '@/lib/auth/refresh';
import { toMeProfile } from '@/lib/auth/profile';
import {
  GoogleAuthError,
  exchangeGoogleCode,
  fetchGoogleProfile,
  upsertGoogleUser,
} from '@/lib/auth/google';

export const runtime = 'nodejs';

/** Map a classified Google failure to the canonical API error envelope. */
function googleErrorResponse(err: GoogleAuthError): NextResponse {
  // Safe server diagnostics: log the classified reason only — never the
  // authorization code, tokens, id_token, client secret, or user data.
  console.error('[auth/google] failed', {
    reason: err.reason,
    providerError: err.providerError,
  });

  if (err.reason === 'not_configured') {
    return apiError('INTERNAL', 'google oauth not configured');
  }
  // exchange_failed / profile_fetch_failed / profile_incomplete are surfaced
  // generically so the client can show a consistent message.
  return apiError('UNAUTHENTICATED', 'google sign-in failed', {
    details: { reason: err.reason },
  });
}

export const POST = apiHandler(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.GoogleAuth.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  let user;
  try {
    const accessToken = await exchangeGoogleCode({
      code: parsed.data.code,
      redirectUri: parsed.data.redirectUri,
      codeVerifier: parsed.data.codeVerifier,
    });
    const profile = await fetchGoogleProfile(accessToken);
    ({ user } = await upsertGoogleUser(profile));
  } catch (err) {
    if (err instanceof GoogleAuthError) return googleErrorResponse(err);
    throw err;
  }

  const userAgent = req.headers.get('user-agent');
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');

  const refresh = await issueRefreshToken(user.id, { userAgent, ip });
  const access = await issueAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    jti: refresh.id,
  });

  const tokens: authContracts.AuthTokens = {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt.toISOString(),
    refreshExpiresAt: refresh.expiresAt.toISOString(),
    user: toMeProfile(user),
  };
  return NextResponse.json(tokens);
});
