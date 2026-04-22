/**
 * POST /api/v1/auth/google — TDD-0001 §3.
 *
 * Client (mobile or SPA) drives the OAuth dance, obtains an
 * authorization code, then posts it here. We exchange the code with
 * Google for an id_token / access_token, derive the user, and return
 * the standard `AuthTokens` envelope.
 *
 * NOTE: this replaces the legacy GET /api/auth/google + /callback pair,
 * which were deleted in the same PR per TDD-0001 §10.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { issueAccessToken } from '@/lib/auth/jwt';
import { issueRefreshToken } from '@/lib/auth/refresh';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return apiError('INTERNAL', 'google oauth not configured');
  }

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

  const params = new URLSearchParams({
    code: parsed.data.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: parsed.data.redirectUri,
    grant_type: 'authorization_code',
  });
  if (parsed.data.codeVerifier) params.set('code_verifier', parsed.data.codeVerifier);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    return apiError('UNAUTHENTICATED', 'google code exchange failed', {
      details: tokenJson.error ? { error: tokenJson.error } : undefined,
    });
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    return apiError('UNAUTHENTICATED', 'google profile fetch failed');
  }
  const profile = (await profileRes.json().catch(() => ({}))) as GoogleUserInfo;
  if (!profile.sub || !profile.email) {
    return apiError('UNAUTHENTICATED', 'google profile incomplete');
  }

  const email = profile.email.toLowerCase();
  const existing = await db.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email }] },
  });

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          googleId: profile.sub,
          displayName: existing.displayName ?? profile.name ?? null,
          avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
          lastActiveAt: new Date(),
        },
      })
    : await db.user.create({
        data: {
          email,
          googleId: profile.sub,
          displayName: profile.name ?? null,
          avatarUrl: profile.picture ?? null,
          lastActiveAt: new Date(),
        },
      });

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
}
