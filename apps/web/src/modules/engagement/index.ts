import { Prisma } from '@prisma/client';
import type { InteractionEntityType, InteractionType } from '@prisma/client';
import { db } from '@/lib/db';
import { Events } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { enqueueNotification } from '@/modules/notifications';

type InteractionInput = {
  userId: string | null;
  entityType: InteractionEntityType;
  entityId: string;
  interactionType: InteractionType;
  cityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordInteraction(input: InteractionInput): Promise<void> {
  try {
    await db.userInteraction.create({
      data: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        interactionType: input.interactionType,
        ...(input.cityId ? { cityId: input.cityId } : {}),
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonObject } : {}),
      },
    });
  } catch {
    // Engagement tracking must never block the primary user action.
  }
}

async function getCommunityForEngagement(communityId: string) {
  return db.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, slug: true, cityId: true, city: { select: { slug: true } } },
  });
}

async function getEventForEngagement(eventId: string) {
  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      cityId: true,
      city: { select: { slug: true } },
      communityId: true,
      community: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function followCommunityForUser(
  userId: string,
  communityId: string,
): Promise<{ followed: true }> {
  const community = await getCommunityForEngagement(communityId);
  await db.savedCommunity.upsert({
    where: { userId_communityId: { userId, communityId } },
    create: { userId, communityId },
    update: {},
  });

  await Promise.all([
    recordInteraction({
      userId,
      entityType: 'COMMUNITY',
      entityId: communityId,
      interactionType: 'SAVE',
      cityId: community?.cityId,
      metadata: { semantic: 'FOLLOW' },
    }),
    captureServerEvent(userId, Events.COMMUNITY_FOLLOWED, {
      community_id: communityId,
      city: community?.city.slug,
    }),
  ]);

  return { followed: true };
}

export async function unfollowCommunityForUser(
  userId: string,
  communityId: string,
): Promise<{ followed: false }> {
  const community = await getCommunityForEngagement(communityId);
  await db.savedCommunity.deleteMany({ where: { userId, communityId } });
  await captureServerEvent(userId, Events.COMMUNITY_UNFOLLOWED, {
    community_id: communityId,
    city: community?.city.slug,
  });
  return { followed: false };
}

export async function toggleFollowCommunityForUser(
  userId: string,
  communityId: string,
): Promise<{ followed: boolean }> {
  const existing = await db.savedCommunity.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { userId: true },
  });
  return existing
    ? unfollowCommunityForUser(userId, communityId)
    : followCommunityForUser(userId, communityId);
}

const REMINDER_OFFSETS = [
  { label: 'T-24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'T-2h', ms: 2 * 60 * 60 * 1000 },
] as const;

async function reactivateSuppressedSavedEventReminder(args: {
  userId: string;
  idempotencyKey: string;
  notBefore: Date;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const result = await db.notificationOutbox.updateMany({
    where: {
      userId: args.userId,
      topic: 'SAVED_EVENT_REMINDER',
      status: 'SUPPRESSED',
      idempotencyKey: args.idempotencyKey,
    },
    data: {
      status: 'PENDING',
      notBefore: args.notBefore,
      payload: args.payload as Prisma.InputJsonValue,
      lastError: null,
      sentAt: null,
    },
  });
  return result.count > 0;
}

export async function scheduleSavedEventReminders(
  userId: string,
  eventId: string,
): Promise<number> {
  const event = await getEventForEngagement(eventId);
  if (!event) return 0;

  const now = new Date();
  let scheduled = 0;
  for (const offset of REMINDER_OFFSETS) {
    const notBefore = new Date(event.startsAt.getTime() - offset.ms);
    if (notBefore <= now) continue;

    const idempotencyKey = `user:${userId}:event:${event.id}:reminder:${offset.label}`;
    const payload = {
      title: event.title,
      body: `${event.title} starts soon.`,
      deepLink: `/${event.city.slug}/events/${event.slug}`,
      eventId: event.id,
      reminderOffset: offset.label,
    };

    const reactivated = await reactivateSuppressedSavedEventReminder({
      userId,
      idempotencyKey,
      notBefore,
      payload,
    });

    if (reactivated) {
      scheduled += 1;
      continue;
    }

    await enqueueNotification({
      userId,
      topic: 'SAVED_EVENT_REMINDER',
      channel: 'PUSH',
      notBefore,
      idempotencyKey,
      payload,
    });
    scheduled += 1;
  }
  return scheduled;
}

export async function suppressSavedEventReminders(
  userId: string,
  eventId: string,
): Promise<number> {
  const result = await db.notificationOutbox.updateMany({
    where: {
      userId,
      topic: 'SAVED_EVENT_REMINDER',
      status: 'PENDING',
      idempotencyKey: { startsWith: `user:${userId}:event:${eventId}:reminder:` },
    },
    data: { status: 'SUPPRESSED' },
  });
  return result.count;
}

export async function saveEventForUser(
  userId: string,
  eventId: string,
  metadata?: Record<string, unknown>,
): Promise<{ saved: true; remindersScheduled: number }> {
  const event = await getEventForEngagement(eventId);
  await db.savedEvent.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId },
    update: {},
  });

  const [remindersScheduled] = await Promise.all([
    scheduleSavedEventReminders(userId, eventId),
    recordInteraction({
      userId,
      entityType: 'EVENT',
      entityId: eventId,
      interactionType: 'SAVE',
      cityId: event?.cityId,
      metadata,
    }),
    captureServerEvent(userId, Events.EVENT_SAVED, {
      event_id: eventId,
      city: event?.city.slug,
      community_id: event?.communityId,
      ...(metadata ?? {}),
    }),
  ]);

  return { saved: true, remindersScheduled };
}

export async function unsaveEventForUser(
  userId: string,
  eventId: string,
  metadata?: Record<string, unknown>,
): Promise<{ saved: false; remindersSuppressed: number }> {
  const event = await getEventForEngagement(eventId);
  await db.savedEvent.deleteMany({ where: { userId, eventId } });
  const remindersSuppressed = await suppressSavedEventReminders(userId, eventId);
  await captureServerEvent(userId, Events.EVENT_UNSAVED, {
    event_id: eventId,
    city: event?.city.slug,
    community_id: event?.communityId,
    ...(metadata ?? {}),
  });
  return { saved: false, remindersSuppressed };
}

export async function toggleSaveEventForUser(
  userId: string,
  eventId: string,
  metadata?: Record<string, unknown>,
): Promise<{ saved: boolean; remindersScheduled?: number; remindersSuppressed?: number }> {
  const existing = await db.savedEvent.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { userId: true },
  });
  return existing
    ? unsaveEventForUser(userId, eventId, metadata)
    : saveEventForUser(userId, eventId, metadata);
}

export async function enqueueCommunityUpdateForFollowers(args: {
  communityId: string;
  eventId: string;
  updateId: string;
}): Promise<{ enqueued: number }> {
  const event = await getEventForEngagement(args.eventId);
  if (!event || !event.communityId) return { enqueued: 0 };

  const followers = await db.savedCommunity.findMany({
    where: { communityId: args.communityId },
    select: { userId: true },
  });

  let enqueued = 0;
  for (const follower of followers) {
    await enqueueNotification({
      userId: follower.userId,
      topic: 'COMMUNITY_UPDATE',
      channel: 'PUSH',
      idempotencyKey: `user:${follower.userId}:community:${args.communityId}:update:${args.updateId}`,
      payload: {
        title: event.title,
        body: `New event from ${event.community?.name ?? 'a community you follow'}.`,
        deepLink: `/${event.city.slug}/events/${event.slug}`,
        communityId: args.communityId,
        eventId: event.id,
      },
    });
    enqueued += 1;
  }

  return { enqueued };
}
