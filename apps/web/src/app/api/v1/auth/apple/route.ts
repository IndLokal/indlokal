/**
 * POST /api/v1/auth/apple — TDD-0001 §3.
 *
 * Client posts the Apple identity token (a JWT signed by Apple) plus
 * the authorization code. We verify the identity token's signature
 * against Apple's JWKS, derive the user from `sub` (Apple's stable user
 * identifier) and return the standard `AuthTokens` envelope.
 *
 * On first-time sign-in Apple sends `user.email` and `user.name` in the
 * payload — we trust those over the JWT claims because Apple omits
 * private-relay email from the token after the first call.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { issueAccessToken } from '@/lib/auth/jwt';
import { issueRefreshToken } from '@/lib/auth/refresh';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getAppleJwks() {
  jwks ??= createRemoteJWKSet(APPLE_JWKS_URL);
  return jwks;
}

/** Test-only: swap the JWKS resolver. */
export function __setAppleJwksForTests(
  override: ReturnType<typeof createRemoteJWKSet> | null,
): void {
  jwks = override;
}

export async function POST(req: NextRequest) {
  const audience = process.env.APPLE_CLIENT_ID;
  if (!audience) {
    return apiError('INTERNAL', 'apple sign-in not configured');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.AppleAuth.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  let payload: { sub?: unknown; email?: unknown };
  try {
    const result = await jwtVerify(parsed.data.identityToken, getAppleJwks(), {
      issuer: APPLE_ISSUER,
      audience,
    });
    payload = result.payload as { sub?: unknown; email?: unknown };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'apple token verification failed';
    return apiError('TOKEN_INVALID', message);
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return apiError('TOKEN_INVALID', 'apple token missing sub');
  }
  const appleId = payload.sub;

  // Email: prefer the first-time payload, fall back to the JWT claim.
  const tokenEmail = typeof payload.email === 'string' ? payload.email : null;
  const firstTimeEmail = parsed.data.user?.email ?? null;
  const email = (firstTimeEmail ?? tokenEmail)?.toLowerCase() ?? null;

  const displayName = parsed.data.user?.name
    ? [parsed.data.user.name.firstName, parsed.data.user.name.lastName]
        .filter((s): s is string => !!s && s.length > 0)
        .join(' ') || null
    : null;

  const existing = await db.user.findFirst({
    where: {
      OR: [{ appleId }, ...(email ? [{ email }] : [])],
    },
  });

  if (!existing && !email) {
    // No prior account and Apple gave us no email → can't create a user.
    return apiError('BAD_REQUEST', 'apple sign-in requires email on first login');
  }

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          appleId,
          displayName: existing.displayName ?? displayName,
          lastActiveAt: new Date(),
        },
      })
    : await db.user.create({
        data: {
          email: email!,
          appleId,
          displayName,
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
