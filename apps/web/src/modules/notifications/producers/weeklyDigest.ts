/**
 * Weekly per-city digest producer - PRD/TDD-0049.
 *
 * Enqueues one INBOX notification per opted-in user per active city that has
 * upcoming events in the next 7 days. Idempotent per ISO week so re-running
 * the producer (or overlapping cron ticks) never double-sends.
 *
 * This is the FIRST retention producer; PUSH/EMAIL fan-out is deferred until
 * those transports ship - INBOX is always available in-app.
 */

import { db } from '@/lib/db';
import { enqueueNotification } from '../outbox';

const DIGEST_TOPIC = 'WEEKLY_DIGEST' as const;
const DIGEST_CHANNEL = 'INBOX' as const;
const MAX_EVENTS_PER_DIGEST = 5;

/** ISO-8601 week stamp, e.g. `2026-W23`, used to scope idempotency keys. */
export function isoWeekStamp(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export type WeeklyDigestResult = {
  cities: number;
  enqueued: number;
};

export async function enqueueWeeklyDigest(now: Date = new Date()): Promise<WeeklyDigestResult> {
  const week = isoWeekStamp(now);
  const windowEnd = new Date(now.getTime() + 7 * 86400000);

  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  });

  let enqueued = 0;
  let citiesWithEvents = 0;

  for (const city of cities) {
    const events = await db.event.findMany({
      where: {
        cityId: city.id,
        moderationState: 'PUBLISHED',
        startsAt: { gte: now, lte: windowEnd },
      },
      orderBy: { startsAt: 'asc' },
      take: MAX_EVENTS_PER_DIGEST,
      select: { id: true, title: true, slug: true, startsAt: true },
    });
    if (events.length === 0) continue;
    citiesWithEvents += 1;

    // Opted-in audience: users who saved a community in this city or saved an
    // event in this city. Keeps the v1 digest targeted to engaged users.
    const audience = await db.user.findMany({
      where: {
        OR: [
          { savedCommunities: { some: { community: { cityId: city.id } } } },
          { savedEvents: { some: { event: { cityId: city.id } } } },
        ],
      },
      select: { id: true },
    });

    for (const user of audience) {
      await enqueueNotification({
        userId: user.id,
        topic: DIGEST_TOPIC,
        channel: DIGEST_CHANNEL,
        idempotencyKey: `WEEKLY_DIGEST:${city.id}:${user.id}:${week}`,
        payload: {
          title: `This week in ${city.name}`,
          body: `${events.length} upcoming event${events.length === 1 ? '' : 's'} you might like.`,
          deepLink: `/${city.slug}`,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            slug: e.slug,
            startsAt: e.startsAt.toISOString(),
          })),
        },
      });
      enqueued += 1;
    }
  }

  return { cities: citiesWithEvents, enqueued };
}
