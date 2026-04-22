/**
 * GET /api/v1/search — Full-text search across communities and events.
 * Optional auth.
 *
 * Query params: q, citySlug, category, from, to, type, cursor, limit
 */

import { NextResponse, type NextRequest } from 'next/server';
import { searchAll } from '@/modules/search';
import { toCommunityCard, toEventCard } from '@/lib/discovery/mappers';
import { apiError } from '@/lib/api/error';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const q = url.searchParams.get('q') ?? '';
  if (!q.trim()) {
    return apiError('BAD_REQUEST', 'q is required');
  }

  const citySlug = url.searchParams.get('citySlug') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : undefined;
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : undefined;
  const typeParam = url.searchParams.get('type');
  const type =
    typeParam === 'COMMUNITY' || typeParam === 'EVENT' || typeParam === 'ALL' ? typeParam : 'ALL';
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const cursor = url.searchParams.get('cursor') ?? undefined;

  const result = await searchAll({
    q,
    citySlug,
    categorySlug: category,
    from,
    to,
    type,
    limit,
    cursor,
  });

  const items = result.items.map((row) => {
    if (row.type === 'COMMUNITY') {
      return { type: 'COMMUNITY' as const, item: toCommunityCard(row.item) };
    }
    return { type: 'EVENT' as const, item: toEventCard(row.item) };
  });

  return NextResponse.json({
    items,
    ...(result.nextCursor && { nextCursor: result.nextCursor }),
  });
}
