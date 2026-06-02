/**
 * POST /api/v1/track - Client-side behavioral event tracking.
 * Optional auth - records userId when a bearer token is present.
 * Writes to user_interactions table for scoring/analytics pipeline.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { optionalAccessToken } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import type { AnalyticsEvent } from '@/lib/analytics/events';

const INTERACTION_TYPE_MAP: Record<string, string> = {
  discover_feed_viewed: 'VIEW',
  discover_card_tapped: 'CLICK_ACCESS',
  community_viewed: 'VIEW',
  community_followed: 'SAVE',
  community_unfollowed: 'SAVE',
  community_access_clicked: 'CLICK_ACCESS',
  event_viewed: 'VIEW',
  event_saved: 'SAVE',
  event_unsaved: 'SAVE',
  event_calendar_added: 'CLICK_ACCESS',
  event_shared: 'SHARE',
  event_register_clicked: 'CLICK_ACCESS',
  [Events.BUSINESS_LENS_VIEWED]: 'VIEW',
};

const POSTHOG_EVENT_MAP: Record<string, AnalyticsEvent> = {
  // Allow callers that already use canonical names to pass through directly.
  [Events.DISCOVER_FEED_VIEWED]: Events.DISCOVER_FEED_VIEWED,
  [Events.COMMUNITY_VIEWED]: Events.COMMUNITY_VIEWED,
  [Events.EVENT_VIEWED]: Events.EVENT_VIEWED,
  [Events.COMMUNITY_FOLLOWED]: Events.COMMUNITY_FOLLOWED,
  [Events.COMMUNITY_UNFOLLOWED]: Events.COMMUNITY_UNFOLLOWED,
  [Events.COMMUNITY_SAVED]: Events.COMMUNITY_SAVED,
  [Events.COMMUNITY_UNSAVED]: Events.COMMUNITY_UNSAVED,
  [Events.EVENT_SAVED]: Events.EVENT_SAVED,
  [Events.EVENT_UNSAVED]: Events.EVENT_UNSAVED,
  [Events.EVENT_CALENDAR_ADDED]: Events.EVENT_CALENDAR_ADDED,
  [Events.EVENT_SHARED]: Events.EVENT_SHARED,
  [Events.EVENT_REGISTER_CLICKED]: Events.EVENT_REGISTER_CLICKED,
  [Events.PROFILE_UPDATED]: Events.PROFILE_UPDATED,
  [Events.CONSULAR_VIEWED]: Events.CONSULAR_VIEWED,
  [Events.THIS_WEEK_VIEWED]: Events.THIS_WEEK_VIEWED,
  [Events.SUBMISSION_IMAGE_ADDED]: Events.SUBMISSION_IMAGE_ADDED,
  [Events.SEARCH_PERFORMED]: Events.SEARCH_PERFORMED,
  [Events.COMMUNITY_ACCESS_CLICKED]: Events.COMMUNITY_ACCESS_CLICKED,
  [Events.BUSINESS_LENS_VIEWED]: Events.BUSINESS_LENS_VIEWED,
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

  // Skip writes that are missing entity context - they're pure analytics pings
  // not tied to a specific entity (e.g. page views).
  if (entityType && entityId) {
    try {
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
    } catch {
      // Tracking is non-critical - always return ok.
    }
  }

  const posthogEvent = POSTHOG_EVENT_MAP[eventType];
  if (posthogEvent) {
    void captureServerEvent(auth?.userId ?? 'anonymous-mobile', posthogEvent, {
      entity_id: entityId,
      entity_type: entityType?.toLowerCase(),
      city: citySlug,
      source_surface: metadata?.source_surface ?? 'track_api',
      original_event: eventType,
      ...(metadata ?? {}),
    });
  }

  return NextResponse.json({ ok: true });
}
