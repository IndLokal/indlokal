/**
 * Row-to-contract mappers for the discovery API endpoints (TDD-0003).
 *
 * Converts Prisma-typed rows (Date objects, Prisma enum literals) into
 * the wire-safe shapes defined in @indlokal/shared contracts.
 */

import type { EventListItem, EventDetailRow } from '@/modules/event/types';
import type { CommunityListItem } from '@/modules/community/types';
import type { discovery as d, events as e } from '@indlokal/shared';

function toIso(date: Date): string {
  return date.toISOString();
}

function toIsoNullable(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function toEventCard(row: EventListItem): d.EventCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    startsAt: toIso(row.startsAt),
    endsAt: toIsoNullable(row.endsAt),
    venueName: row.venueName,
    isOnline: row.isOnline,
    cost: row.cost,
    imageUrl: row.imageUrl,
    isRecurring: row.isRecurring,
    community: row.community,
    city: row.city,
    categories: row.categories,
  };
}

export function toCommunityCard(
  row: CommunityListItem & { _count: { events: number } },
): d.CommunityCard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    status: row.status as d.CommunityStatus,
    activityScore: row.activityScore,
    completenessScore: row.completenessScore,
    trustScore: row.trustScore,
    isTrending: row.isTrending,
    claimState: row.claimState as d.ClaimState,
    memberCountApprox: row.memberCountApprox ?? null,
    logoUrl: row.logoUrl ?? null,
    lastActivityAt: toIsoNullable(row.lastActivityAt),
    languages: row.languages,
    city: row.city,
    categories: row.categories,
    upcomingEventCount: row._count.events,
  };
}

export function toEventDetail(row: EventDetailRow): e.EventDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    status: row.status as e.EventStatus,
    startsAt: toIso(row.startsAt),
    endsAt: toIsoNullable(row.endsAt),
    venueName: row.venueName ?? null,
    venueAddress: row.venueAddress ?? null,
    isOnline: row.isOnline,
    onlineUrl: row.onlineLink ?? null,
    cost: row.cost ?? null,
    imageUrl: row.imageUrl ?? null,
    isRecurring: row.isRecurring,
    registrationUrl: row.registrationUrl ?? null,
    community: row.community ?? null,
    city: row.city,
    categories: row.categories,
    trustSignals: row.trustSignals.map((ts) => ({
      id: ts.id,
      signalType: ts.signalType as e.TrustSignalType,
      createdAt: toIso(ts.createdAt),
    })),
    relatedEvents: row.relatedEvents.map(toEventCard),
  };
}
