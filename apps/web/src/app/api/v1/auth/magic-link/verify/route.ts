/**
 * POST /api/v1/auth/magic-link/verify — TDD-0001 §3.
 *
 * Consumes a one-time magic-link token and returns an `AuthTokens`
 * envelope (access JWT + refresh token + user profile). The token is
 * marked as used atomically so it cannot be replayed.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { hashToken } from '@/lib/session';
import { issueAccessToken } from '@/lib/auth/jwt';
import { issueRefreshToken } from '@/lib/auth/refresh';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.MagicLinkVerify.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const tokenHash = await hashToken(parsed.data.token);

  // Atomically claim the token: only succeeds if not yet used and not expired.
  const claim = await db.magicLinkToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claim.count === 0) {
    return apiError('TOKEN_INVALID', 'magic link is invalid, expired, or already used');
  }

  const row = await db.magicLinkToken.findUnique({
    where: { tokenHash },
    select: { user: true },
  });
  if (!row?.user) {
    return apiError('TOKEN_INVALID', 'magic link no longer valid');
  }

  const userAgent = req.headers.get('user-agent');
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');

  const refresh = await issueRefreshToken(row.user.id, { userAgent, ip });
  const access = await issueAccessToken({
    userId: row.user.id,
    email: row.user.email,
    role: row.user.role,
    jti: refresh.id,
  });

  await db.user.update({
    where: { id: row.user.id },
    data: { lastActiveAt: new Date() },
  });

  const tokens: authContracts.AuthTokens = {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt.toISOString(),
    refreshExpiresAt: refresh.expiresAt.toISOString(),
    user: toMeProfile(row.user),
  };
  return NextResponse.json(tokens);
});
