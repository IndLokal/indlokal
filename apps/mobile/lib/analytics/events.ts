/**
 * Mobile analytics event catalog + payload builder - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports) so it is unit-testable in Node. The Expo
 * wrapper in `track.expo.ts` posts the built payload to POST /api/v1/track.
 *
 * Event names mirror the catalog recognized server-side by the track route
 * (apps/web/src/app/api/v1/track/route.ts) so web + mobile share one funnel
 * (MOBILE_WEB_INTEGRATION.md §8).
 */

export const ANALYTICS_EVENTS = {
  discoverFeedViewed: 'discover.feed.viewed',
  discoverCardTapped: 'discover.card.tapped',
  eventDetailViewed: 'event.detail.viewed',
  eventSaved: 'event.saved',
  eventCalendarAdded: 'event.calendar_added',
  eventShared: 'event.shared',
  eventRegisterClicked: 'event.register_clicked',
  // Client-only pings (server records them only when entity-bound; otherwise ignored).
  profileUpdated: 'profile.updated',
  consularViewed: 'consular.viewed',
  thisWeekViewed: 'this_week.viewed',
  submissionImageAdded: 'submission.image_added',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsEntityType = 'COMMUNITY' | 'EVENT' | 'RESOURCE';

export interface TrackInput {
  event: AnalyticsEventName | string;
  entityType?: AnalyticsEntityType;
  entityId?: string;
  citySlug?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackPayload {
  event: string;
  entityType?: AnalyticsEntityType;
  entityId?: string;
  citySlug?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Normalize a tracking input into the wire payload accepted by /api/v1/track.
 * Drops empty optional fields so we never send `entityId: undefined`.
 */
export function buildTrackPayload(input: TrackInput): TrackPayload {
  const payload: TrackPayload = { event: input.event };
  if (input.entityType) payload.entityType = input.entityType;
  if (input.entityId && input.entityId.length > 0) payload.entityId = input.entityId;
  if (input.citySlug && input.citySlug.length > 0) payload.citySlug = input.citySlug;
  if (input.metadata && Object.keys(input.metadata).length > 0) payload.metadata = input.metadata;
  return payload;
}
