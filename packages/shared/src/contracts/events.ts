/**
 * Event-detail contracts — TDD-0005.
 */

import { z } from 'zod';
import { Ack, Cuid, IsoDateTime } from './common.js';
import { EventCard, CommunityRef, CityRef, CategoryRef } from './discovery.js';

// ─── Full event detail ─────────────────────────────────────────────────────

export const TrustSignalType = z.enum([
  'ADMIN_VERIFIED',
  'COMMUNITY_CLAIMED',
  'USER_REPORTED_ACCURATE',
  'USER_REPORTED_STALE',
  'EDITORIAL_REVIEWED',
]);
export type TrustSignalType = z.infer<typeof TrustSignalType>;

export const TrustSignal = z.object({
  id: Cuid,
  signalType: TrustSignalType,
  createdAt: IsoDateTime,
});
export type TrustSignal = z.infer<typeof TrustSignal>;

export const EventStatus = z.enum(['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED']);
export type EventStatus = z.infer<typeof EventStatus>;

export const EventDetail = z.object({
  id: Cuid,
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: EventStatus,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  isOnline: z.boolean(),
  onlineUrl: z.string().nullable(),
  cost: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isRecurring: z.boolean(),
  registrationUrl: z.string().nullable(),
  community: CommunityRef.extend({ logoUrl: z.string().nullable() }).nullable(),
  city: CityRef,
  categories: z.array(z.object({ category: CategoryRef })),
  trustSignals: z.array(TrustSignal),
  relatedEvents: z.array(EventCard),
});
export type EventDetail = z.infer<typeof EventDetail>;

// ─── Save / unsave ────────────────────────────────────────────────────────

export const SaveState = z.object({ saved: z.boolean() });
export type SaveState = z.infer<typeof SaveState>;

// ─── Client-side event tracking ──────────────────────────────────────────

export const TrackEventType = z.enum([
  'event.detail.viewed',
  'event.saved',
  'event.calendar_added',
  'event.shared',
  'event.register_clicked',
  'discover.feed.viewed',
  'discover.card.tapped',
]);
export type TrackEventType = z.infer<typeof TrackEventType>;

export const TrackEvent = z.object({
  event: TrackEventType,
  entityType: z.enum(['COMMUNITY', 'EVENT', 'RESOURCE']).optional(),
  entityId: Cuid.optional(),
  citySlug: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type TrackEvent = z.infer<typeof TrackEvent>;

export { Ack };
