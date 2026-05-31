import { db } from '@/lib/db';

/**
 * Event host workspace helpers (PRD/TDD-0038, blueprint docs/HOST_DASHBOARD.md).
 *
 * Mirrors the community organizer workspace pattern (lib/organizer/workspace.ts)
 * for the independent event-host portal. All overview signals are derived from the
 * event moderation + lifecycle axes (docs/EVENTS_AND_LIFECYCLE.md §5) and the
 * first-class `Event.createdByUserId`, never from `trustSignals` or
 * `metadata.hostUserId`.
 */

/** Cap on outstanding un-reviewed (pending) upcoming events per host (EVENTS §9). */
export const HOST_UNVERIFIED_CAP = 5;

export type HostProfile = {
  displayName: string | null;
  cityId: string | null;
  links: string[];
};

type HostUserLike = {
  displayName: string | null;
  cityId: string | null;
  metadata: unknown;
};

/** Typed read of `User.metadata.hostProfile`, falling back to the user's own fields. */
export function getHostProfile(user: HostUserLike): HostProfile {
  const raw = (user.metadata as Record<string, unknown> | null)?.hostProfile as
    | { displayName?: string; cityId?: string; links?: string[] }
    | undefined;

  return {
    displayName: raw?.displayName ?? user.displayName ?? null,
    cityId: raw?.cityId ?? user.cityId ?? null,
    links: Array.isArray(raw?.links)
      ? raw!.links.filter((l): l is string => typeof l === 'string')
      : [],
  };
}

export type HostCompletenessItem = { label: string; done: boolean };

export type HostCompleteness = {
  items: HostCompletenessItem[];
  doneCount: number;
  pct: number;
};

/** Profile-completeness meter (blueprint §8). A nudge, never a gate. */
export function computeHostCompleteness(profile: HostProfile, hasEvent: boolean): HostCompleteness {
  const items: HostCompletenessItem[] = [
    { label: 'Display name', done: !!profile.displayName },
    { label: 'City', done: !!profile.cityId },
    { label: 'At least one link', done: profile.links.length >= 1 },
    { label: 'A second link', done: profile.links.length >= 2 },
    { label: 'First event posted', done: hasEvent },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return {
    items,
    doneCount,
    pct: Math.round((doneCount / items.length) * 100),
  };
}

export type HostEventRow = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  status: 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  moderationState: 'PUBLISHED' | 'PENDING_REVIEW' | 'REJECTED';
  reviewReason: string | null;
  isOnline: boolean;
  venueName: string | null;
  city: { name: string; slug: string };
};

export type HostEventStats = {
  /** Published & upcoming (not cancelled). */
  live: number;
  /** Awaiting platform review. */
  inReview: number;
  /** Rejected by a reviewer. */
  declined: number;
  /** Already finished (by start time). */
  past: number;
  /** Upcoming & not cancelled, any moderation state — powers the "My Events" card. */
  upcoming: number;
  /** Pending-review upcoming events counted against the cap. */
  unverifiedUpcomingCount: number;
  /** Nearest upcoming event (published or pending), or null. */
  nextUpcoming: HostEventRow | null;
  /** Rejected events with their reviewer reason, for "needs attention". */
  declinedEvents: HostEventRow[];
};

/**
 * Pure bucketing of a host's events into overview signals. Separated from the DB
 * read so it is unit-testable without a database (blueprint §7).
 */
export function bucketHostEvents(events: HostEventRow[], now: Date = new Date()): HostEventStats {
  let live = 0;
  let inReview = 0;
  let declined = 0;
  let past = 0;
  let upcoming = 0;
  let unverifiedUpcomingCount = 0;
  let nextUpcoming: HostEventRow | null = null;
  const declinedEvents: HostEventRow[] = [];

  for (const e of events) {
    const isUpcoming = e.startsAt >= now && e.status !== 'CANCELLED';
    const isPast = e.startsAt < now;

    if (isPast) past += 1;
    if (isUpcoming) {
      upcoming += 1;
      if (!nextUpcoming || e.startsAt < nextUpcoming.startsAt) nextUpcoming = e;
    }

    if (e.moderationState === 'PUBLISHED' && isUpcoming) live += 1;
    if (e.moderationState === 'PENDING_REVIEW') {
      inReview += 1;
      if (e.startsAt >= now) unverifiedUpcomingCount += 1;
    }
    if (e.moderationState === 'REJECTED') {
      declined += 1;
      declinedEvents.push(e);
    }
  }

  return {
    live,
    inReview,
    declined,
    past,
    upcoming,
    unverifiedUpcomingCount,
    nextUpcoming,
    declinedEvents,
  };
}

/** Fetch a host's events and compute overview signals. */
export async function getHostEventStats(
  userId: string,
  now: Date = new Date(),
): Promise<HostEventStats> {
  const events = await db.event.findMany({
    where: { createdByUserId: userId },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      status: true,
      moderationState: true,
      reviewReason: true,
      isOnline: true,
      venueName: true,
      city: { select: { name: true, slug: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  return bucketHostEvents(events as HostEventRow[], now);
}
