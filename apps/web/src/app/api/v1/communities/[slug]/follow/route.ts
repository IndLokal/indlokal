/**
 * POST   /api/v1/communities/:slug/follow  — follow (requires auth)
 * DELETE /api/v1/communities/:slug/follow  — unfollow (requires auth)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { getCommunityDetail, followCommunity, unfollowCommunity } from '@/modules/community';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';

export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const auth = await requireAccessToken(req);
    if (!auth.ok) return auth.response;

    const { slug } = await ctx.params;
    const row = await getCommunityDetail(slug);
    if (!row) return apiError('NOT_FOUND', 'community not found');

    await followCommunity(auth.user.userId, row.id);
    return NextResponse.json({ followed: true });
  },
);

export const DELETE = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const auth = await requireAccessToken(req);
    if (!auth.ok) return auth.response;

    const { slug } = await ctx.params;
    const row = await getCommunityDetail(slug);
    if (!row) return apiError('NOT_FOUND', 'community not found');

    await unfollowCommunity(auth.user.userId, row.id);
    return NextResponse.json({ followed: false });
  },
);
