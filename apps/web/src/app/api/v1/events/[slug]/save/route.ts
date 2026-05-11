/**
 * POST   /api/v1/events/:slug/save  — save an event (requires auth)
 * DELETE /api/v1/events/:slug/save  — unsave an event (requires auth)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { getEventDetail, saveEvent, unsaveEvent } from '@/modules/event';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';

export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const auth = await requireAccessToken(req);
    if (!auth.ok) return auth.response;

    const { slug } = await ctx.params;
    const row = await getEventDetail(slug);
    if (!row) return apiError('NOT_FOUND', 'event not found');

    await saveEvent(auth.user.userId, row.id);
    return NextResponse.json({ saved: true });
  },
);

export const DELETE = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const auth = await requireAccessToken(req);
    if (!auth.ok) return auth.response;

    const { slug } = await ctx.params;
    const row = await getEventDetail(slug);
    if (!row) return apiError('NOT_FOUND', 'event not found');

    await unsaveEvent(auth.user.userId, row.id);
    return NextResponse.json({ saved: false });
  },
);
