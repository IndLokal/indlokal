/**
 * GET /api/v1/discovery/:citySlug/events — cursor-paginated event feed.
 * Public, no auth required. TDD-0003 §3.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { discovery as d } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { getEventsPage } from '@/modules/event';
import { toEventCard } from '@/lib/discovery/mappers';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ citySlug: string }> },
) {
  const { citySlug } = await ctx.params;
  const sp = new URL(req.url).searchParams;

  const parsed = d.EventsQuery.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid query params', { details: parsed.error.flatten() });
  }

  const { from, to, cursor, limit = DEFAULT_LIMIT, categorySlug } = parsed.data;

  const { items, hasMore } = await getEventsPage(citySlug, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    cursor,
    limit,
    categorySlug,
  });

  const nextCursor = hasMore ? items[items.length - 1].id : undefined;
  return NextResponse.json({
    items: items.map(toEventCard),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  } satisfies d.EventsPage);
}
