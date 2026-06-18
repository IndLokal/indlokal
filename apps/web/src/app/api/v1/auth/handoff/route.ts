/**
 * POST /api/v1/auth/handoff - TDD-0058 (app → web hand-off).
 *
 * A signed-in mobile client (JWT) requests a one-time URL it can open in an
 * in-app browser to land on web already authenticated. We mint a short-lived,
 * single-use token (hashed at rest) and return the URL — never a long-lived
 * secret.
 *
 * Flag-gated by AUTH_WEB_HANDOFF_ENABLED: when off the route 404s so the
 * feature is inert.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { mintWebHandoffToken } from '@/lib/auth/web-handoff';
import { FLAGS } from '@/lib/config/flags';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  if (!FLAGS.authWebHandoffEnabled) {
    return apiError('NOT_FOUND', 'not found');
  }

  const authResult = await requireAccessToken(req);
  if (!authResult.ok) return authResult.response;

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.WebHandoffRequest.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const minted = await mintWebHandoffToken({
    userId: authResult.user.userId,
    next: parsed.data.next,
  });

  const response: authContracts.WebHandoffResponse = {
    url: minted.url,
    expiresAt: minted.expiresAt.toISOString(),
  };
  return NextResponse.json(response);
});
