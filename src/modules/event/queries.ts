import { db } from '@/lib/db';
import { SCORING } from '@/lib/config';
import { endOfWeek, endOfMonth } from 'date-fns';
import type { EventWithRelations, EventListItem } from './types';

const eventListSelect = {
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
 * Resolve city IDs including metro satellites.
 */
async function resolveCityIds(citySlug: string): Promise<string[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];
  return [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
}

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
