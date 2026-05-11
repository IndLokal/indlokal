/**
 * POST /api/v1/auth/refresh — TDD-0001 §3, §8.
 * Rotates the refresh token and issues a fresh access JWT.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { issueAccessToken } from '@/lib/auth/jwt';
import { rotateRefreshToken, RefreshTokenError } from '@/lib/auth/refresh';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.RefreshRequest.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const userAgent = req.headers.get('user-agent');
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');

  let result;
  try {
    result = await rotateRefreshToken(parsed.data.refreshToken, { userAgent, ip });
  } catch (err) {
    if (err instanceof RefreshTokenError) {
      return apiError(err.code, err.message);
    }
    throw err;
  }

  const user = await db.user.findUnique({ where: { id: result.userId } });
  if (!user) {
    return apiError('TOKEN_INVALID', 'user no longer exists');
  }

  const access = await issueAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    jti: result.refresh.id,
  });

  const tokens: authContracts.AuthTokens = {
    accessToken: access.token,
    refreshToken: result.refresh.token,
    accessExpiresAt: access.expiresAt.toISOString(),
    refreshExpiresAt: result.refresh.expiresAt.toISOString(),
    user: toMeProfile(user),
  };
  return NextResponse.json(tokens);
});
