/**
 * GET /api/v1/discovery/:citySlug/trending — top trending communities,
 * upcoming events, and category grid for the city.
 * Public, no auth required. TDD-0003 §3.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { discovery as d } from '@indlokal/shared';
import { apiError } from '@/lib/api/error';
import { getTrending } from '@/modules/discovery';
import { toEventCard, toCommunityCard } from '@/lib/discovery/mappers';
import { withPublicCache } from '@/lib/api/cache';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await ctx.params;
  const result = await getTrending(citySlug);
  if (!result) return apiError('NOT_FOUND', 'city not found');

  return withPublicCache(
    NextResponse.json({
      communities: result.communities.map(toCommunityCard),
      events: result.events.map(toEventCard),
      categories: result.categories,
    } satisfies d.TrendingResponse),
    { sMaxAge: 60 },
  );
}
