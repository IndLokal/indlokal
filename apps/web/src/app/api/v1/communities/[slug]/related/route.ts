/**
 * GET /api/v1/communities/:slug/related — Related communities via graph edges.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCommunityDetail, getRelatedCommunities } from '@/modules/community';
import { toCommunitySummary } from '@/lib/discovery/mappers';
import { apiError } from '@/lib/api/error';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await ctx.params;

  const row = await getCommunityDetail(slug);
  if (!row) return apiError('NOT_FOUND', 'community not found');

  const related = await getRelatedCommunities(row.id, 5);
  return NextResponse.json(related.map(toCommunitySummary));
}
