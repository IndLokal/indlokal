/**
 * POST /api/v1/track — Client-side behavioral event tracking.
 * Optional auth — records userId when a bearer token is present.
 * Writes to user_interactions table for scoring/analytics pipeline.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { optionalAccessToken } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';

const INTERACTION_TYPE_MAP: Record<string, string> = {
  'event.detail.viewed': 'VIEW',
  'event.saved': 'SAVE',
  'event.calendar_added': 'CLICK_ACCESS',
  'event.shared': 'SHARE',
  'event.register_clicked': 'CLICK_ACCESS',
  'discover.feed.viewed': 'VIEW',
  'discover.card.tapped': 'CLICK_ACCESS',
};

const TrackBody = z.object({
  event: z.string(),
  entityType: z.enum(['COMMUNITY', 'EVENT', 'RESOURCE']).optional(),
  entityId: z.string().optional(),
  citySlug: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await optionalAccessToken(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = TrackBody.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid track payload', { details: parsed.error.flatten() });
  }

  const { event: eventType, entityType, entityId, citySlug, metadata } = parsed.data;
  const interactionType = INTERACTION_TYPE_MAP[eventType] ?? 'VIEW';

  // Skip writes that are missing entity context — they're pure analytics pings
  // not tied to a specific entity (e.g. page views).
  if (entityType && entityId) {
    // Resolve city id if slug provided (best-effort, no hard error)
    let cityId: string | undefined;
    if (citySlug) {
      const city = await db.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
      cityId = city?.id;
    }

    await db.userInteraction.create({
      data: {
        userId: auth?.userId ?? null,
        entityType,
        entityId,
        interactionType: interactionType as
          | 'VIEW'
          | 'CLICK_ACCESS'
          | 'SAVE'
          | 'SHARE'
          | 'REPORT'
          | 'SEARCH',
        ...(cityId ? { cityId } : {}),
        metadata: metadata as object | undefined,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
