import { db, resolveCityIds } from '@/lib/db';
import { SCORING } from '@/lib/config';
import { endOfWeek, endOfMonth } from 'date-fns';
import type { EventWithRelations, EventListItem, EventDetailRow } from './types';

export const eventListSelect = {
  id: true,
  title: true,
  slug: true,
  startsAt: true,
  endsAt: true,
  venueName: true,
  isOnline: true,
  cost: true,
  imageUrl: true,
  isRecurring: true,
  community: { select: { name: true, slug: true } },
  city: { select: { name: true, slug: true } },
  categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
} as const;

/**
 * Get a single event with full relations.
 */
export async function getEventBySlug(slug: string): Promise<EventWithRelations | null> {
  return db.event.findUnique({
    where: { slug },
    include: {
      community: { select: { id: true, name: true, slug: true, logoUrl: true } },
      city: true,
      categories: { include: { category: true } },
    },
  });
}

/**
 * Get events for "This Week" in a city.
 * Implements sparse-content resilience: if fewer than SPARSE_CONTENT_THRESHOLD
 * events this week, auto-expands to "this month".
 */
export async function getEventsThisWeek(
  citySlug: string,
): Promise<{ events: EventListItem[]; expandedToMonth: boolean }> {
  const cityIds = await resolveCityIds(citySlug);
  if (cityIds.length === 0) return { events: [], expandedToMonth: false };

  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Monday start

  // Try this week first
  const weekEvents = await db.event.findMany({
    where: {
      cityId: { in: cityIds },
      startsAt: { gte: now, lte: weekEnd },
      status: { not: 'CANCELLED' },
    },
    select: eventListSelect,
    orderBy: { startsAt: 'asc' },
  });

  if (weekEvents.length >= SCORING.SPARSE_CONTENT_THRESHOLD) {
    return { events: weekEvents, expandedToMonth: false };
  }

  // Sparse content — expand to this month
  const monthEnd = endOfMonth(now);
  const monthEvents = await db.event.findMany({
    where: {
      cityId: { in: cityIds },
      startsAt: { gte: now, lte: monthEnd },
      status: { not: 'CANCELLED' },
    },
    select: eventListSelect,
    orderBy: { startsAt: 'asc' },
  });

  return { events: monthEvents, expandedToMonth: true };
}

/**
 * Get upcoming events for a city with optional filters.
 */
/**
 * Cursor-paginated event list — powers GET /api/v1/discovery/:citySlug/events.
 */
export async function getEventsPage(
  citySlug: string,
  opts: {
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
    categorySlug?: string;
    communityId?: string;
  },
): Promise<{ items: EventListItem[]; hasMore: boolean; nextCursor?: string }> {
  const cityIds = await resolveCityIds(citySlug);
  if (!cityIds.length) return { items: [], hasMore: false };

  const rows = await db.event.findMany({
    where: {
      cityId: { in: cityIds },
      status: { not: 'CANCELLED' },
      startsAt: {
        gte: opts.from ?? new Date(),
        ...(opts.to && { lte: opts.to }),
      },
      ...(opts.categorySlug && {
        categories: { some: { category: { slug: opts.categorySlug } } },
      }),
      ...(opts.communityId && { communityId: opts.communityId }),
    },
    select: eventListSelect,
    orderBy: { startsAt: 'asc' },
    take: opts.limit + 1,
    ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
  });

  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  return { items, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export async function getUpcomingEvents(
  citySlug: string,
  options?: {
    categorySlug?: string;
    limit?: number;
    offset?: number;
  },
): Promise<EventListItem[]> {
  const cityIds = await resolveCityIds(citySlug);
  if (cityIds.length === 0) return [];

  return db.event.findMany({
    where: {
      cityId: { in: cityIds },
      startsAt: { gte: new Date() },
      status: { not: 'CANCELLED' },
      ...(options?.categorySlug && {
        categories: { some: { category: { slug: options.categorySlug } } },
      }),
    },
    select: eventListSelect,
    orderBy: { startsAt: 'asc' },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });
}

/**
 * Full event detail including trust signals and related upcoming events
 * from the same community. Powers GET /api/v1/events/:slug.
 */
export async function getEventDetail(slug: string): Promise<EventDetailRow | null> {
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      community: { select: { id: true, name: true, slug: true, logoUrl: true } },
      city: { select: { name: true, slug: true } },
      categories: { include: { category: { select: { name: true, slug: true, icon: true } } } },
      trustSignals: {
        select: { id: true, signalType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!event) return null;

  // Related: up to 3 upcoming events from the same community (excluding this one).
  const relatedEvents = event.communityId
    ? await db.event.findMany({
        where: {
          communityId: event.communityId,
          id: { not: event.id },
          startsAt: { gte: new Date() },
          status: { not: 'CANCELLED' },
        },
        select: eventListSelect,
        orderBy: { startsAt: 'asc' },
        take: 3,
      })
    : [];

  return { ...event, relatedEvents };
}

/**
 * Save an event for a user. Idempotent (no error if already saved).
 */
export async function saveEvent(userId: string, eventId: string): Promise<void> {
  await db.savedEvent.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId },
    update: {},
  });
}

/**
 * Unsave an event for a user. Idempotent (no error if not saved).
 */
export async function unsaveEvent(userId: string, eventId: string): Promise<void> {
  await db.savedEvent.deleteMany({ where: { userId, eventId } });
}

/**
 * Check whether a user has saved a given event.
 */
export async function isEventSaved(userId: string, eventId: string): Promise<boolean> {
  const row = await db.savedEvent.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { userId: true },
  });
  return row !== null;
}

export interface SavedEventRow {
  eventId: string;
  savedAt: Date;
  event: {
    id: string;
    title: string;
    slug: string;
    startsAt: Date;
    endsAt: Date | null;
    venueName: string | null;
    isOnline: boolean;
    city: { name: string; slug: string };
  };
}

/**
 * Cursor-paginated list of events saved by a user.
 * Cursor is the eventId of the last seen item.
 */
export async function getSavedEvents(
  userId: string,
  opts: { cursor?: string; limit: number },
): Promise<{ items: SavedEventRow[]; hasMore: boolean }> {
  const rows = await db.savedEvent.findMany({
    where: { userId },
    select: {
      eventId: true,
      savedAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          endsAt: true,
          venueName: true,
          isOnline: true,
          city: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor && { cursor: { userId_eventId: { userId, eventId: opts.cursor } }, skip: 1 }),
  });
  const hasMore = rows.length > opts.limit;
  return { items: hasMore ? rows.slice(0, opts.limit) : rows, hasMore };
}
