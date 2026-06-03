/**
 * Saved-event reminder producer - PRD/TDD-0049.
 *
 * Enqueues one INBOX reminder per user who saved an event that starts in the
 * next 24-48h window. Idempotent per (event, user) so the reminder fires once.
 */

import { db } from '@/lib/db';
import { enqueueNotification } from '../outbox';

const REMINDER_TOPIC = 'SAVED_EVENT_REMINDER' as const;
const REMINDER_CHANNEL = 'INBOX' as const;

export type SavedEventReminderResult = {
  events: number;
  enqueued: number;
};

export async function enqueueSavedEventReminders(
  now: Date = new Date(),
): Promise<SavedEventReminderResult> {
  const windowStart = new Date(now.getTime() + 24 * 3600000);
  const windowEnd = new Date(now.getTime() + 48 * 3600000);

  const events = await db.event.findMany({
    where: {
      moderationState: 'PUBLISHED',
      startsAt: { gte: windowStart, lte: windowEnd },
      savedBy: { some: {} },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      city: { select: { slug: true } },
      savedBy: { select: { userId: true } },
    },
  });

  let enqueued = 0;

  for (const event of events) {
    for (const saved of event.savedBy) {
      await enqueueNotification({
        userId: saved.userId,
        topic: REMINDER_TOPIC,
        channel: REMINDER_CHANNEL,
        idempotencyKey: `SAVED_EVENT_REMINDER:${event.id}:${saved.userId}`,
        notBefore: windowStart,
        payload: {
          title: `Reminder: ${event.title}`,
          body: `Starts ${event.startsAt.toISOString()}.`,
          deepLink: `/${event.city.slug}/events/${event.slug}`,
          eventId: event.id,
        },
      });
      enqueued += 1;
    }
  }

  return { events: events.length, enqueued };
}
