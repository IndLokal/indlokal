/**
 * GET /api/v1/discovery/:citySlug/events — cursor-paginated event feed.
 * Public, no auth required. TDD-0003 §3.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { discovery as d } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { getEventsPage } from '@/modules/event';
import { toEventCard } from '@/lib/discovery/mappers';
import { withPublicCache } from '@/lib/api/cache';

export const runtime = 'nodejs';
export const revalidate = 300;

const DEFAULT_LIMIT = 20;

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ citySlug: string }> }) => {
    const { citySlug } = await ctx.params;
    const sp = new URL(req.url).searchParams;

    const parsed = d.EventsQuery.safeParse(Object.fromEntries(sp));
    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'invalid query params', { details: parsed.error.flatten() });
    }

    const { from, to, cursor, limit = DEFAULT_LIMIT, categorySlug } = parsed.data;

    const { items, nextCursor } = await getEventsPage(citySlug, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor,
      limit,
      categorySlug,
    });

    return withPublicCache(
      NextResponse.json({
        items: items.map(toEventCard),
        ...(nextCursor !== undefined ? { nextCursor } : {}),
      } satisfies d.EventsPage),
      { sMaxAge: 300 },
    );
  },
);
