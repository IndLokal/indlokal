/**
 * GET /api/v1/notifications/inbox?cursor=&limit= — TDD-0002 §3.
 *
 * Cursor-based pagination, newest first. The cursor is the opaque
 * `id` of the oldest item in the previous page. Page size is clamped
 * to [1, 50] (default 20).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { notifications as n } from '@indlokal/shared';
import { db } from '@/lib/db';
import { requireAccessToken } from '@/lib/auth/middleware';
import { apiHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const items = await db.inboxItem.findMany({
    where: { userId: auth.user.userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  const body: n.InboxPage = {
    items: page.map((row) => ({
      id: row.id,
      topic: row.topic,
      title: row.title,
      body: row.body,
      deepLink: row.deepLink,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    })),
    ...(hasMore && page.length > 0 ? { nextCursor: page[page.length - 1].id } : {}),
  };
  return NextResponse.json(body);
});
