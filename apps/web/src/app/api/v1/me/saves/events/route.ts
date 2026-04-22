/**
 * GET /api/v1/me/saves/events?cursor&limit — Paginated saved events for the authenticated user.
 * Requires access token. TDD-0010.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { getSavedEvents } from '@/modules/event';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const limitParam = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);

  const { items, hasMore } = await getSavedEvents(auth.user.userId, { cursor, limit });

  const mapped = items.map((row) => ({
    id: row.event.id,
    title: row.event.title,
    slug: row.event.slug,
    startsAt: row.event.startsAt.toISOString(),
    endsAt: row.event.endsAt?.toISOString() ?? null,
    venueName: row.event.venueName ?? null,
    isOnline: row.event.isOnline,
    savedAt: row.savedAt.toISOString(),
    city: row.event.city,
  }));

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].eventId : undefined;

  return NextResponse.json({ items: mapped, nextCursor });
}
