/**
 * GET /api/v1/me — TDD-0001 §3.
 * Returns the authenticated user's `MeProfile`. First consumer of the
 * `requireAccessToken` middleware.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({ where: { id: auth.user.userId } });
  if (!user) return apiError('NOT_FOUND', 'user not found');

  return NextResponse.json(toMeProfile(user));
});
