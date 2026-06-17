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
  discoverFeedViewed: 'discover_feed_viewed',
  discoverCardTapped: 'discover_card_tapped',
  communityDetailViewed: 'community_viewed',
  communityFollowed: 'community_followed',
  communityUnfollowed: 'community_unfollowed',
  communityChannelTapped: 'community_access_clicked',
  eventDetailViewed: 'event_viewed',
  eventSaved: 'event_saved',
  eventUnsaved: 'event_unsaved',
  eventCalendarAdded: 'event_calendar_added',
  eventShared: 'event_shared',
  eventRegisterClicked: 'event_register_clicked',
  businessLensViewed: 'business_lens_viewed',
  // Client-only pings (server records them only when entity-bound; otherwise ignored).
  profileUpdated: 'profile_updated',
  consularViewed: 'consular_viewed',
  thisWeekViewed: 'this_week_viewed',
  submissionImageAdded: 'submission_image_added',

  // Resources improvement baseline (Sprint 1)
  resourcesHubView: 'resources_hub_view',
  resourcesPersonaSelected: 'resources_persona_selected',
  resourcesIntentChipSelected: 'resources_intent_chip_selected',
  resourcesEssentialsClick: 'resources_essentials_click',
  resourcesTrustBadgeImpression: 'resources_trust_badge_impression',
  resourcesFirstMeaningfulAction: 'resources_first_meaningful_action',
  resourcesToRelatedClick: 'resources_to_related_click',
  resourcesStaleItemOpened: 'resources_stale_item_opened',
  resourcesExperimentVariantAssigned: 'resources_experiment_variant_assigned',
  journeyNextActionImpression: 'journey_next_action_impression',
  journeyNextActionClick: 'journey_next_action_click',
  journeyNextActionCompleted: 'journey_next_action_completed',
  journeyStepCompleted: 'journey_step_completed',
  journeyResumePromptShown: 'journey_resume_prompt_shown',
  journeyResumeClicked: 'journey_resume_clicked',
  journeyProgressReset: 'journey_progress_reset',
  resourceCtaImpression: 'resource_cta_impression',
  resourceCtaClick: 'resource_cta_click',
  resourceCtaVariantAssigned: 'resource_cta_variant_assigned',
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
