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

  // Resources improvement baseline (Sprint 1)
  RESOURCES_HUB_VIEW: 'resources_hub_view',
  RESOURCES_PERSONA_SELECTED: 'resources_persona_selected',
  RESOURCES_INTENT_CHIP_SELECTED: 'resources_intent_chip_selected',
  RESOURCES_ESSENTIALS_CLICK: 'resources_essentials_click',
  RESOURCES_TRUST_BADGE_IMPRESSION: 'resources_trust_badge_impression',
  RESOURCES_FIRST_MEANINGFUL_ACTION: 'resources_first_meaningful_action',
  RESOURCES_TO_RELATED_CLICK: 'resources_to_related_click',
  RESOURCE_SAVED: 'resource_saved',
  RESOURCE_UNSAVED: 'resource_unsaved',
  RESOURCES_STALE_ITEM_OPENED: 'resources_stale_item_opened',
  RESOURCES_EXPERIMENT_VARIANT_ASSIGNED: 'resources_experiment_variant_assigned',
  JOURNEY_NEXT_ACTION_IMPRESSION: 'journey_next_action_impression',
  JOURNEY_NEXT_ACTION_CLICK: 'journey_next_action_click',
  JOURNEY_NEXT_ACTION_COMPLETED: 'journey_next_action_completed',
  JOURNEY_STEP_COMPLETED: 'journey_step_completed',
  JOURNEY_RESUME_PROMPT_SHOWN: 'journey_resume_prompt_shown',
  JOURNEY_RESUME_CLICKED: 'journey_resume_clicked',
  JOURNEY_PROGRESS_RESET: 'journey_progress_reset',
  RESOURCE_CTA_IMPRESSION: 'resource_cta_impression',
  RESOURCE_CTA_CLICK: 'resource_cta_click',
  RESOURCE_CTA_VARIANT_ASSIGNED: 'resource_cta_variant_assigned',

  // Journey Layer (PRD/TDD-0052)
  JOURNEY_ENTRY_CLICK: 'journey_entry_click',
  JOURNEY_VIEW: 'journey_view',
  JOURNEY_STAGE_VIEW: 'journey_stage_view',
  JOURNEY_BLOCK_ACTION: 'journey_block_action',
  JOURNEY_SAVE: 'journey_save',
  JOURNEY_PERSONA_SWITCH: 'journey_persona_switch',

  // Conversion - high-value business outcomes
  COMMUNITY_SUBMITTED: 'community_submitted',
  CLAIM_SUBMITTED: 'claim_submitted',
  CONTRIBUTION_STARTED: 'contribution_started',
  CONTRIBUTION_SUBMITTED: 'contribution_submitted',
  CONTRIBUTION_REVIEWED: 'contribution_reviewed',

  // Governance - community authority changes (ADR-0008 / TDD-0036)
  COMMUNITY_ROLE_CHANGED: 'community_role_changed',

  // Governance - event moderation (ADR-0009 / PRD-0037)
  HOST_EVENT_SUBMITTED_FOR_REVIEW: 'host_event_submitted_for_review',
  EVENT_REVIEW_DECISION: 'event_review_decision',

  // Event host workspace (PRD-0038)
  HOST_PROFILE_UPDATED: 'host_profile_updated',

  // JITO Stuttgart Business Connect pilot (curated India-Germany enquiries)
  BUSINESS_CONNECT_PAGE_VIEW: 'business_connect_page_view',
  BUSINESS_CONNECT_SUBMIT_STARTED: 'business_connect_submit_started',
  BUSINESS_CONNECT_SUBMIT_SUCCESS: 'business_connect_submit_success',
  BUSINESS_CONNECT_SUBMIT_ERROR: 'business_connect_submit_error',

  // Ops observability - scheduled pipeline health
  PIPELINE_SHARD_COMPLETED: 'pipeline_shard_completed',
  PIPELINE_DISPATCHED: 'pipeline_dispatched',
} as const;

export type AnalyticsEvent = (typeof Events)[keyof typeof Events];
