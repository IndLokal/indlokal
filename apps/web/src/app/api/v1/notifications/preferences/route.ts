/**
 * GET /api/v1/notifications/preferences — TDD-0002 §3.
 * PUT /api/v1/notifications/preferences — partial update.
 *
 * GET always returns the full topic × channel matrix (defaults filled
 * in). PUT accepts a partial patch; omitted (topic, channel) pairs
 * keep their existing value.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { notifications as n } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/preferences';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const prefs = await getNotificationPreferences(auth.user.userId);
  return NextResponse.json(prefs);
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = n.NotificationPreferencesUpdate.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const prefs = await updateNotificationPreferences(auth.user.userId, parsed.data);
  return NextResponse.json(prefs);
});
