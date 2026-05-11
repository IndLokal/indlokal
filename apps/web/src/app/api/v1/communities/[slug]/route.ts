/**
 * GET /api/v1/communities/:slug — Community detail.
 * Optional auth — includes followedByUser if bearer token present.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { optionalAccessToken } from '@/lib/auth/middleware';
import { getCommunityDetail, isCommunityFollowed } from '@/modules/community';
import { toCommunityDetail } from '@/lib/discovery/mappers';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const auth = await optionalAccessToken(req);

    const row = await getCommunityDetail(slug);
    if (!row) {
      return apiError('NOT_FOUND', 'community not found');
    }

    const detail = toCommunityDetail(row);
    const followedByUser = auth ? await isCommunityFollowed(auth.userId, row.id) : undefined;

    return NextResponse.json({
      ...detail,
      ...(followedByUser !== undefined && { followedByUser }),
    });
  },
);
