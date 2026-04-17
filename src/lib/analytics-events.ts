/**
 * Canonical PostHog event names — single source of truth.
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
  // Lifecycle — user auth state changes
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',

  // Engagement — meaningful user interactions
  SEARCH_PERFORMED: 'search_performed',
  COMMUNITY_VIEWED: 'community_viewed',
  EVENT_VIEWED: 'event_viewed',
  COMMUNITY_ACCESS_CLICKED: 'community_access_clicked',
  COMMUNITY_SAVED: 'community_saved',
  COMMUNITY_UNSAVED: 'community_unsaved',

  // Conversion — high-value business outcomes
  COMMUNITY_SUBMITTED: 'community_submitted',
  CLAIM_SUBMITTED: 'claim_submitted',
} as const;

export type AnalyticsEvent = (typeof Events)[keyof typeof Events];
