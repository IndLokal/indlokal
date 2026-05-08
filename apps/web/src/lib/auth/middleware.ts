/**
 * Bearer-token middleware helpers — TDD-0001 §1.
 *
 * Usage in a route handler (e.g. /api/v1/me/route.ts):
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await requireAccessToken(req);
 *     if (!auth.ok) return auth.response;
 *     // auth.user.userId, auth.user.role, ...
 *   }
 *
 * Why a discriminated union instead of throwing:
 * - Next.js route handlers must return a Response. A try/catch in every
 *   handler is verbose. Returning the canonical 401 envelope from one place
 *   keeps all handlers thin.
 *
 * The actual /api/v1 endpoints are NOT shipped in this PR (foundation
 * only). This middleware is provided for the next implementation PR.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { TokenVerificationError, verifyAccessToken, type VerifiedAccessToken } from './jwt';

export type AuthContext = VerifiedAccessToken;

type AuthSuccess = { ok: true; user: AuthContext };
type AuthFailure = { ok: false; response: NextResponse };

const BEARER_PREFIX = /^Bearer\s+/i;

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  if (!BEARER_PREFIX.test(header)) return null;
  return header.replace(BEARER_PREFIX, '').trim() || null;
}

function unauthorized(
  code: 'UNAUTHENTICATED' | 'TOKEN_EXPIRED' | 'TOKEN_INVALID',
  message: string,
) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer error="${code === 'TOKEN_EXPIRED' ? 'invalid_token' : 'invalid_request'}"`,
      },
    },
  );
}

/**
 * Validates the Authorization header and returns the verified user
 * context, or a ready-to-return 401 response.
 */
export async function requireAccessToken(req: NextRequest): Promise<AuthSuccess | AuthFailure> {
  const token = extractBearer(req);
  if (!token) {
    return { ok: false, response: unauthorized('UNAUTHENTICATED', 'missing bearer token') };
  }

  try {
    const user = await verifyAccessToken(token);
    return { ok: true, user };
  } catch (err) {
    if (err instanceof TokenVerificationError) {
      return { ok: false, response: unauthorized(err.code, err.message) };
    }
    return { ok: false, response: unauthorized('TOKEN_INVALID', 'token verification failed') };
  }
}

/**
 * Like requireAccessToken but returns null instead of a response when
 * the user is anonymous. For endpoints that personalize their output
 * but do not require auth (per TDD-0003 the discovery feed is one).
 */
export async function optionalAccessToken(req: NextRequest): Promise<AuthContext | null> {
  const token = extractBearer(req);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    // Optional auth: a bad token is treated as anonymous.
    return null;
  }
}
