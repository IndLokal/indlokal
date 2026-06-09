/**
 * Community Module
 *
 * The central domain module. Communities are the primary node in the
 * community graph. All discovery, scoring, and relationship logic
 * flows through or connects to communities.
 *
 * Responsibilities:
 * - CRUD for community entities
 * - Community lifecycle (unverified → active → claimed)
 * - Profile completeness computation
 * - Access channel management
 */
export {
  getCommunityBySlug,
  getCommunityRedirectTarget,
  getCommunitiesByCity,
  countCommunitiesByCity,
  getCommunitiesPage,
  getCommunityDetail,
  getRelatedCommunities,
  followCommunity,
  unfollowCommunity,
  isCommunityFollowed,
  getSavedCommunities,
  getCommunitiesForPersona,
} from './queries';
export type {
  CommunityWithRelations,
  CommunityListItem,
  CommunityDetailRow,
  CommunitySummaryRow,
} from './types';
export type { SavedCommunityRow, JourneyCommunityRow } from './queries';
