/**
 * Organizer & host analytics readout (PRD/TDD-0050).
 *
 * Read-only aggregation over the existing `UserInteraction` signal so
 * organizers and hosts can finally see their reach (views / access-clicks /
 * saves). No new data model — this surfaces data the platform already records.
 *
 * Authorization is the caller's responsibility: these functions take ids the
 * caller has already been authorized for (organizer/host pages gate access).
 */
import { db } from '@/lib/db';
import { subDays } from 'date-fns';
import type { InteractionType } from '@prisma/client';

export interface ReachTotals {
  views: number;
  accessClicks: number;
  saves: number;
}

export interface TopEventReach {
  eventId: string;
  title: string;
  slug: string;
  views: number;
  saves: number;
}

export interface CommunityReach extends ReachTotals {
  sinceDays: number;
  topEvents: TopEventReach[];
}

export interface HostReach extends ReachTotals {
  sinceDays: number;
  topEvents: TopEventReach[];
}

function tallyByType(rows: Array<{ interactionType: InteractionType }>): ReachTotals {
  let views = 0;
  let accessClicks = 0;
  let saves = 0;
  for (const r of rows) {
    if (r.interactionType === 'VIEW') views += 1;
    else if (r.interactionType === 'CLICK_ACCESS') accessClicks += 1;
    else if (r.interactionType === 'SAVE') saves += 1;
  }
  return { views, accessClicks, saves };
}

function topEventsFromInteractions(
  interactions: Array<{ entityId: string; interactionType: InteractionType }>,
  eventMeta: Map<string, { title: string; slug: string }>,
  limit = 5,
): TopEventReach[] {
  const byEvent = new Map<string, { views: number; saves: number }>();
  for (const i of interactions) {
    const meta = eventMeta.get(i.entityId);
    if (!meta) continue;
    const cur = byEvent.get(i.entityId) ?? { views: 0, saves: 0 };
    if (i.interactionType === 'VIEW') cur.views += 1;
    else if (i.interactionType === 'SAVE') cur.saves += 1;
    byEvent.set(i.entityId, cur);
  }
  return [...byEvent.entries()]
    .map(([eventId, counts]) => ({
      eventId,
      title: eventMeta.get(eventId)?.title ?? 'Event',
      slug: eventMeta.get(eventId)?.slug ?? '',
      views: counts.views,
      saves: counts.saves,
    }))
    .sort((a, b) => b.views - a.views || b.saves - a.saves)
    .slice(0, limit);
}

/**
 * Reach for a single community over the last `sinceDays` days: community-level
 * views/access-clicks/saves plus a top-events breakdown.
 */
export async function getCommunityReach(
  communityId: string,
  sinceDays = 30,
): Promise<CommunityReach> {
  const since = subDays(new Date(), sinceDays);
  const empty: CommunityReach = {
    views: 0,
    accessClicks: 0,
    saves: 0,
    sinceDays,
    topEvents: [],
  };

  try {
    const events = await db.event.findMany({
      where: { communityId },
      select: { id: true, title: true, slug: true },
    });
    const eventMeta = new Map(events.map((e) => [e.id, { title: e.title, slug: e.slug }]));
    const eventIds = events.map((e) => e.id);

    const [communityRows, eventRows] = await Promise.all([
      db.userInteraction.findMany({
        where: {
          entityType: 'COMMUNITY',
          entityId: communityId,
          interactionType: { in: ['VIEW', 'CLICK_ACCESS', 'SAVE'] },
          createdAt: { gte: since },
        },
        select: { interactionType: true },
      }),
      eventIds.length > 0
        ? db.userInteraction.findMany({
            where: {
              entityType: 'EVENT',
              entityId: { in: eventIds },
              interactionType: { in: ['VIEW', 'SAVE'] },
              createdAt: { gte: since },
            },
            select: { entityId: true, interactionType: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      ...tallyByType(communityRows),
      sinceDays,
      topEvents: topEventsFromInteractions(eventRows, eventMeta),
    };
  } catch {
    // Analytics readout must never break the dashboard.
    return empty;
  }
}

/**
 * Reach for an event host: aggregates views/saves over all events the host
 * created (PRD-0017 hosts own events without a community).
 */
export async function getHostReach(userId: string, sinceDays = 30): Promise<HostReach> {
  const since = subDays(new Date(), sinceDays);
  const empty: HostReach = { views: 0, accessClicks: 0, saves: 0, sinceDays, topEvents: [] };

  try {
    const events = await db.event.findMany({
      where: { createdByUserId: userId },
      select: { id: true, title: true, slug: true },
    });
    if (events.length === 0) return empty;

    const eventMeta = new Map(events.map((e) => [e.id, { title: e.title, slug: e.slug }]));
    const eventIds = events.map((e) => e.id);

    const rows = await db.userInteraction.findMany({
      where: {
        entityType: 'EVENT',
        entityId: { in: eventIds },
        interactionType: { in: ['VIEW', 'SAVE'] },
        createdAt: { gte: since },
      },
      select: { entityId: true, interactionType: true },
    });

    const totals = tallyByType(rows);
    return {
      views: totals.views,
      accessClicks: 0,
      saves: totals.saves,
      sinceDays,
      topEvents: topEventsFromInteractions(rows, eventMeta),
    };
  } catch {
    return empty;
  }
}
