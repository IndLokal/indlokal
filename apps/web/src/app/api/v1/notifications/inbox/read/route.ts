/**
 * POST /api/v1/notifications/inbox/read — TDD-0002 §3.
 * Marks the given inbox items as read for the authenticated user.
 * Items belonging to other users are silently ignored (scoped by userId).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { notifications as n } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { requireAccessToken } from '@/lib/auth/middleware';
import { apiHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = n.InboxReadRequest.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  await db.inboxItem.updateMany({
    where: {
      id: { in: parsed.data.ids },
      userId: auth.user.userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
