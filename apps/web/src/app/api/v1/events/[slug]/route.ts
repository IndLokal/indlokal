/**
 * GET /api/v1/events/:slug — Event detail.
 * Optional auth — includes savedByUser if bearer token present.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { optionalAccessToken } from '@/lib/auth/middleware';
import { getEventDetail, isEventSaved } from '@/modules/event';
import { toEventDetail } from '@/lib/discovery/mappers';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const auth = await optionalAccessToken(req);

    const row = await getEventDetail(slug);
    if (!row) {
      return apiError('NOT_FOUND', 'event not found');
    }

    const detail = toEventDetail(row);

    const savedByUser = auth ? await isEventSaved(auth.userId, row.id) : undefined;

    return NextResponse.json({ ...detail, ...(savedByUser !== undefined && { savedByUser }) });
  },
);
