/**
 * GET /api/v1/discovery/:citySlug/communities — cursor-paginated community feed.
 * Public, no auth required. TDD-0003 §3.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { discovery as d } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { getCommunitiesPage } from '@/modules/community';
import { toCommunityCard } from '@/lib/discovery/mappers';
import { withPublicCache } from '@/lib/api/cache';

export const runtime = 'nodejs';
export const revalidate = 300;

const DEFAULT_LIMIT = 20;

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ citySlug: string }> }) => {
    const { citySlug } = await ctx.params;
    const sp = new URL(req.url).searchParams;

    const parsed = d.CommunitiesQuery.safeParse(Object.fromEntries(sp));
    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'invalid query params', { details: parsed.error.flatten() });
    }

    const { cursor, limit = DEFAULT_LIMIT, categorySlug } = parsed.data;

    const { items, hasMore } = await getCommunitiesPage(citySlug, { cursor, limit, categorySlug });

    const nextCursor = hasMore ? items[items.length - 1].id : undefined;
    return withPublicCache(
      NextResponse.json({
        items: items.map(toCommunityCard),
        ...(nextCursor !== undefined ? { nextCursor } : {}),
      } satisfies d.CommunitiesPage),
      { sMaxAge: 300 },
    );
  },
);
