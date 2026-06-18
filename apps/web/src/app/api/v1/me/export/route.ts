/**
 * GET /api/v1/me/export - GDPR portability export for the authenticated user.
 * Returns a JSON snapshot of account-linked data without secrets.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const authn = await requireAccessToken(req);
  if (!authn.ok) return authn.response;

  const userId = authn.user.userId;

  const [
    user,
    createdCommunities,
    createdEvents,
    savedCommunities,
    savedEvents,
    savedResources,
    contentReports,
    notificationPreferences,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        city: { select: { name: true } },
        roleAssignments: {
          select: { role: true, cityId: true, orgId: true, revokedAt: true },
        },
        claimedCommunities: {
          where: { claimState: 'CLAIMED' },
          select: { id: true, claimedByUserId: true },
        },
      },
    }),
    db.community.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        createdAt: true,
        city: { select: { id: true, slug: true, name: true } },
      },
    }),
    db.event.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        status: true,
        moderationState: true,
        createdAt: true,
        city: { select: { id: true, slug: true, name: true } },
      },
    }),
    db.savedCommunity.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: {
        savedAt: true,
        community: {
          select: {
            id: true,
            slug: true,
            name: true,
            city: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    }),
    db.savedEvent.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: {
        savedAt: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            status: true,
            moderationState: true,
            city: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    }),
    db.savedResource.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: {
        savedAt: true,
        resource: {
          select: {
            id: true,
            slug: true,
            title: true,
            city: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    }),
    db.contentReport.findMany({
      where: { reporterUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        status: true,
        details: true,
        reporterEmail: true,
        communityId: true,
        eventId: true,
        suggestedName: true,
        cityId: true,
        createdAt: true,
      },
    }),
    db.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ topic: 'asc' }, { channel: 'asc' }],
      select: { topic: true, channel: true, enabled: true },
    }),
  ]);

  if (!user) return apiError('NOT_FOUND', 'user not found');

  const payload = {
    exportedAt: new Date().toISOString(),
    user: toMeProfile(user),
    createdCommunities: createdCommunities.map((row) => ({
      community: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        city: row.city,
      },
      createdAt: row.createdAt.toISOString(),
    })),
    createdEvents: createdEvents.map((row) => ({
      event: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        status: row.status,
        moderationState: row.moderationState,
        city: row.city,
      },
      createdAt: row.createdAt.toISOString(),
    })),
    savedCommunities: savedCommunities.map((row) => ({
      community: {
        id: row.community.id,
        slug: row.community.slug,
        name: row.community.name,
        city: row.community.city,
      },
      savedAt: row.savedAt.toISOString(),
    })),
    savedEvents: savedEvents.map((row) => ({
      event: {
        id: row.event.id,
        slug: row.event.slug,
        title: row.event.title,
        startsAt: row.event.startsAt.toISOString(),
        status: row.event.status,
        moderationState: row.event.moderationState,
        city: row.event.city,
      },
      savedAt: row.savedAt.toISOString(),
    })),
    savedResources: savedResources.map((row) => ({
      resource: {
        id: row.resource.id,
        slug: row.resource.slug,
        title: row.resource.title,
        city: row.resource.city,
      },
      savedAt: row.savedAt.toISOString(),
    })),
    contentReports: contentReports.map((row) => ({
      id: row.id,
      reportType: row.reportType,
      status: row.status,
      details: row.details,
      reporterEmail: row.reporterEmail,
      communityId: row.communityId,
      eventId: row.eventId,
      suggestedName: row.suggestedName,
      cityId: row.cityId,
      createdAt: row.createdAt.toISOString(),
    })),
    notificationPreferences: notificationPreferences.map((row) => ({
      topic: row.topic,
      channel: row.channel,
      enabled: row.enabled,
    })),
  };

  const parsed = auth.MeDataExport.parse(payload);

  try {
    await db.contentLog.create({
      data: {
        entityType: 'privacy_request',
        entityId: userId,
        action: 'CREATED',
        changedBy: userId,
        metadata: {
          requestType: 'GDPR_EXPORT_SELF_SERVICE',
          exportedAt: parsed.exportedAt,
        },
      },
    });
  } catch (err) {
    // Export must stay available even if audit write fails.
    console.warn('[GDPR] Failed to record export audit entry:', String(err));
  }

  return NextResponse.json(parsed);
});
