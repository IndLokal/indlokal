/**
 * GET /api/v1/communities/:slug/events?cursor=&limit= — Paginated upcoming events
 * for a specific community. Optional auth (no personalization yet).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCommunityDetail } from '@/modules/community';
import { getEventsPage } from '@/modules/event';
import { toEventCard } from '@/lib/discovery/mappers';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { discovery as d } from '@indlokal/shared';

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;

    const row = await getCommunityDetail(slug);
    if (!row) return apiError('NOT_FOUND', 'community not found');

    const { searchParams } = new URL(req.url);
    const queryResult = d.EventsQuery.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      categorySlug: searchParams.get('categorySlug') ?? undefined,
    });
    if (!queryResult.success) {
      return apiError('BAD_REQUEST', 'invalid query params', {
        details: queryResult.error.flatten(),
      });
    }

    const opts = queryResult.data;
    const { items, hasMore, nextCursor } = await getEventsPage(row.city.slug, {
      communityId: row.id,
      cursor: opts.cursor,
      limit: opts.limit ?? 20,
      from: opts.from ? new Date(opts.from) : undefined,
      to: opts.to ? new Date(opts.to) : undefined,
      categorySlug: opts.categorySlug,
    });

    return NextResponse.json({
      items: items.map(toEventCard),
      hasMore,
      nextCursor: nextCursor ?? null,
    });
  },
);
