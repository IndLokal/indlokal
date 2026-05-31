/**
 * Community authority - ADR-0008 / TDD-0036.
 *
 * The single sanctioned way to authorize community writes. Reads role-bearing
 * membership from `CommunityCollaborator` (exposed on the session user as
 * `communityMemberships`), NOT `User.role` and NOT the workspace cookie.
 *
 * Authority levels (from CollaboratorRole):
 *   OWNER        - the organizer; full control incl. ownership transfer & member management
 *   COLLABORATOR - edit content only
 *
 * PLATFORM_ADMIN always passes (platform-role fast-path, mirrors can()).
 */

import type { CollaboratorRole, UserRole } from '@prisma/client';

export type CommunityMembership = {
  communityId: string;
  role: CollaboratorRole;
};

/** Minimal session shape this module needs. */
export type CommunityAuthorityUser = {
  id: string;
  role: UserRole;
  communityMemberships?: CommunityMembership[];
  /**
   * Safety net so a claimed organizer never loses access if their OWNER
   * membership row has not been backfilled yet.
   */
  claimedCommunities?: ReadonlyArray<{ id: string; claimedByUserId?: string | null }>;
};

export type CommunityLevel = 'view' | 'edit' | 'manage' | 'own';

// OWNER (organizer) + COLLABORATOR may edit; only OWNER may manage members.
const EDIT_ROLES: CollaboratorRole[] = ['COMMUNITY_ADMIN', 'COLLABORATOR'];
const MANAGE_ROLES: CollaboratorRole[] = ['COMMUNITY_ADMIN'];

/**
 * Resolve the user's active role for a community, or null if they have none.
 * Falls back to OWNER when the user is the claimed owner but the membership
 * row has not been backfilled yet (backfill safety, TDD-0036).
 */
export function getCommunityRole(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
): CollaboratorRole | null {
  if (!user) return null;

  const membership = user.communityMemberships?.find((m) => m.communityId === communityId);
  if (membership) return membership.role;

  // Backfill safety net: claimed owner without a membership row is still OWNER.
  const claimed = user.claimedCommunities?.find(
    (c) => c.id === communityId && c.claimedByUserId === user.id,
  );
  if (claimed) return 'COMMUNITY_ADMIN';

  return null;
}

export function isCommunityOwner(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
): boolean {
  if (user && user.role === 'PLATFORM_ADMIN') return true;
  return getCommunityRole(user, communityId) === 'COMMUNITY_ADMIN';
}

/** OWNER (organizer) - may manage members and edit content. */
export function canManageCommunity(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
): boolean {
  if (user && user.role === 'PLATFORM_ADMIN') return true;
  const role = getCommunityRole(user, communityId);
  return role !== null && MANAGE_ROLES.includes(role);
}

/** OWNER | COLLABORATOR - may edit content. */
export function canEditCommunity(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
): boolean {
  if (user && user.role === 'PLATFORM_ADMIN') return true;
  const role = getCommunityRole(user, communityId);
  return role !== null && EDIT_ROLES.includes(role);
}

function hasLevel(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
  level: CommunityLevel,
): boolean {
  switch (level) {
    case 'view':
      return getCommunityRole(user, communityId) !== null || user?.role === 'PLATFORM_ADMIN';
    case 'edit':
      return canEditCommunity(user, communityId);
    case 'manage':
      return canManageCommunity(user, communityId);
    case 'own':
      return isCommunityOwner(user, communityId);
    default:
      return false;
  }
}

/** Throws `Forbidden` when the user lacks the required level. */
export function assertCommunity(
  user: CommunityAuthorityUser | null | undefined,
  communityId: string,
  level: CommunityLevel,
): void {
  if (!hasLevel(user, communityId, level)) {
    throw new Error(`Forbidden: missing community authority '${level}' for ${communityId}`);
  }
}
