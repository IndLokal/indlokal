/**
 * Canonical PostHog event names - single source of truth.
 *
 * Shared between client components (via @/lib/analytics) and
 * server actions / API routes (imported directly).
 *
 * Rules:
 * - snake_case, all lowercase
 * - verb_object pattern (e.g. community_submitted, not submit_community)
 * - add new events here, never as inline strings
 */

export const Events = {
  // Lifecycle - user auth state changes
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',

  // Engagement - meaningful user interactions
  SEARCH_PERFORMED: 'search_performed',
  DISCOVER_FEED_VIEWED: 'discover_feed_viewed',
  COMMUNITY_VIEWED: 'community_viewed',
  EVENT_VIEWED: 'event_viewed',
  COMMUNITY_ACCESS_CLICKED: 'community_access_clicked',
  COMMUNITY_FOLLOWED: 'community_followed',
  COMMUNITY_UNFOLLOWED: 'community_unfollowed',
  COMMUNITY_SAVED: 'community_saved',
  COMMUNITY_UNSAVED: 'community_unsaved',
  EVENT_SAVED: 'event_saved',
  EVENT_UNSAVED: 'event_unsaved',
  EVENT_CALENDAR_ADDED: 'event_calendar_added',
  EVENT_SHARED: 'event_shared',
  EVENT_REGISTER_CLICKED: 'event_register_clicked',
  PROFILE_UPDATED: 'profile_updated',
  CONSULAR_VIEWED: 'consular_viewed',
  THIS_WEEK_VIEWED: 'this_week_viewed',
  SUBMISSION_IMAGE_ADDED: 'submission_image_added',
  BUSINESS_LENS_VIEWED: 'business_lens_viewed',

  // Conversion - high-value business outcomes
  COMMUNITY_SUBMITTED: 'community_submitted',
  CLAIM_SUBMITTED: 'claim_submitted',

  // Governance - community authority changes (ADR-0008 / TDD-0036)
  COMMUNITY_ROLE_CHANGED: 'community_role_changed',

  // Governance - event moderation (ADR-0009 / PRD-0037)
  HOST_EVENT_SUBMITTED_FOR_REVIEW: 'host_event_submitted_for_review',
  EVENT_REVIEW_DECISION: 'event_review_decision',

  // Event host workspace (PRD-0038)
  HOST_PROFILE_UPDATED: 'host_profile_updated',

  // Ops observability - scheduled pipeline health
  PIPELINE_SHARD_COMPLETED: 'pipeline_shard_completed',
  PIPELINE_DISPATCHED: 'pipeline_dispatched',
} as const;

export type AnalyticsEvent = (typeof Events)[keyof typeof Events];
