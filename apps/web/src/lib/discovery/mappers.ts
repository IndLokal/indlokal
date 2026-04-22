/**
 * Row-to-contract mappers for the discovery API endpoints (TDD-0003).
 *
 * Converts Prisma-typed rows (Date objects, Prisma enum literals) into
 * the wire-safe shapes defined in @indlokal/shared contracts.
 */

import type { EventListItem, EventDetailRow } from '@/modules/event/types';
import type {
  CommunityListItem,
  CommunityDetailRow,
  CommunitySummaryRow,
} from '@/modules/community/types';
import type { discovery as d, events as e, community as c } from '@indlokal/shared';

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

export function toCommunityDetail(row: CommunityDetailRow): c.CommunityDetail {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    descriptionLong: row.descriptionLong ?? null,
    status: row.status as c.CommunityDetail['status'],
    claimState: row.claimState as c.CommunityDetail['claimState'],
    logoUrl: row.logoUrl ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    personaSegments: row.personaSegments,
    languages: row.languages,
    foundedYear: row.foundedYear ?? null,
    memberCountApprox: row.memberCountApprox ?? null,
    activityScore: row.activityScore,
    completenessScore: row.completenessScore,
    trustScore: row.trustScore,
    isTrending: row.isTrending,
    lastActivityAt: toIsoNullable(row.lastActivityAt),
    city: row.city,
    categories: row.categories,
    accessChannels: row.accessChannels.map((ch) => ({
      id: ch.id,
      channelType: ch.channelType as c.ChannelType,
      url: ch.url,
      label: ch.label ?? null,
      isPrimary: ch.isPrimary,
      isVerified: ch.isVerified,
    })),
    trustSignals: row.trustSignals.map((ts) => ({
      id: ts.id,
      signalType: ts.signalType as c.TrustSignal['signalType'],
      createdAt: toIso(ts.createdAt),
    })),
    upcomingEventCount: row._count.events,
  };
}

export function toCommunitySummary(row: CommunitySummaryRow): c.CommunitySummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    logoUrl: row.logoUrl ?? null,
    memberCountApprox: row.memberCountApprox ?? null,
    city: row.city,
    categories: row.categories,
    upcomingEventCount: row._count.events,
  };
}
