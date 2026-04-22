/**
 * POST /api/v1/auth/logout — TDD-0001 §3.
 * Revokes the supplied refresh token. Idempotent: always returns 200.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { revokeRefreshToken } from '@/lib/auth/refresh';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

  await revokeRefreshToken(parsed.data.refreshToken);
  return NextResponse.json({ ok: true });
}
