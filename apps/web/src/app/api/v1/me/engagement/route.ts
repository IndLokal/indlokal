/**
 * GET /api/v1/me/engagement - Following, saved events, and notification preference summary.
 * Requires access token. PRD/TDD-0041.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { getNotificationPreferences } from '@/lib/notifications/preferences';
import { getSavedCommunities } from '@/modules/community';
import { getSavedEvents } from '@/modules/event';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const [communities, events, notificationPreferences] = await Promise.all([
    getSavedCommunities(auth.user.userId, { limit: 50 }),
    getSavedEvents(auth.user.userId, { limit: 50 }),
    getNotificationPreferences(auth.user.userId),
  ]);

  return NextResponse.json({
    followingCommunities: communities.items.map((row) => ({
      id: row.community.id,
      name: row.community.name,
      slug: row.community.slug,
      description: row.community.description ?? null,
      logoUrl: row.community.logoUrl ?? null,
      memberCountApprox: row.community.memberCountApprox ?? null,
      followedAt: row.savedAt.toISOString(),
      city: row.community.city,
    })),
    savedEvents: events.items.map((row) => ({
      id: row.event.id,
      title: row.event.title,
      slug: row.event.slug,
      startsAt: row.event.startsAt.toISOString(),
      endsAt: row.event.endsAt?.toISOString() ?? null,
      venueName: row.event.venueName ?? null,
      isOnline: row.event.isOnline,
      savedAt: row.savedAt.toISOString(),
      city: row.event.city,
    })),
    notificationPreferences,
  });
});
