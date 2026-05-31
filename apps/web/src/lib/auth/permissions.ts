/**
 * Authorization - ADR-0005 / PRD-0014
 *
 * Single source of truth for "can this user perform this action?".
 *
 * Usage in a Server Action:
 *   const user = await getSessionUser();
 *   if (!can(user, 'pipeline.approve')) throw new Error('Forbidden');
 *
 * Usage in a layout/page (redirect pattern):
 *   const user = await requireCan('admin.data.write');   // throws redirect
 *
 * Design:
 * - User.role (the primary/display role) drives the fast-path. A
 *   PLATFORM_ADMIN can do everything without a RoleAssignment row.
 * - For all other roles, can() checks the in-memory roleAssignments[] that
 *   getSessionUser() already eager-loads (zero extra DB round-trips).
 * - Scoped actions (e.g. 'city.submit' with cityId) verify the assignment's
 *   cityId matches the requested scope.
 */

import type { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import {
  canEditCommunity,
  canManageCommunity,
  type CommunityMembership,
} from '@/lib/auth/community-permissions';

// ─────────────────────────────────────────────────
// Action catalog
// ─────────────────────────────────────────────────

export type Action =
  // Admin - data
  | 'admin.data.read'
  | 'admin.data.write'
  | 'admin.data.delete' // destructive; founder-only by default
  // Admin - pipeline & submissions
  | 'pipeline.read'
  | 'pipeline.approve'
  | 'pipeline.reject'
  | 'pipeline.run' // trigger scrape; OPS_LEAD+
  // Admin - claims
  | 'claims.read'
  | 'claims.approve'
  | 'claims.reject'
  // Admin - event moderation (ADR-0009)
  | 'events.review.read'
  | 'events.review.approve'
  | 'events.review.reject'
  // Admin - scoring
  | 'scoring.read'
  | 'scoring.run'
  // Admin - merge
  | 'merge.read'
  | 'merge.execute'
  // Admin - reports
  | 'reports.read'
  | 'reports.resolve'
  // Admin - team / role assignments
  | 'team.read' // view role assignments
  | 'team.grant' // grant roles (platform admin only)
  | 'team.revoke' // revoke roles (platform admin only)
  // Admin - audit log
  | 'audit.read'
  // Outreach CRM
  | 'outreach.read'
  | 'outreach.write'
  // Ambassador console (always city-scoped - pass cityId as scope)
  | 'ambassador.read'
  | 'ambassador.submit'
  | 'ambassador.checkin'
  // Organizer
  | 'organizer.edit' // edit own community
  | 'organizer.events.write'
  // Content editor
  | 'content.write';

// ─────────────────────────────────────────────────
// Role → action map
// ─────────────────────────────────────────────────

const ROLE_ACTIONS: Record<UserRole, Action[]> = {
  PLATFORM_ADMIN: [], // handled by the PLATFORM_ADMIN fast-path below (all actions)
  PARTNERSHIPS_LEAD: [
    'admin.data.read',
    'pipeline.read',
    'pipeline.approve',
    'pipeline.reject',
    'claims.read',
    'claims.approve',
    'claims.reject',
    'events.review.read',
    'events.review.approve',
    'events.review.reject',
    'reports.read',
    'reports.resolve',
    'team.read',
    'audit.read',
    'outreach.read',
    'outreach.write',
  ],
  OPS_LEAD: [
    'admin.data.read',
    'admin.data.write',
    'pipeline.read',
    'pipeline.approve',
    'pipeline.reject',
    'pipeline.run',
    'claims.read',
    'claims.approve',
    'claims.reject',
    'events.review.read',
    'events.review.approve',
    'events.review.reject',
    'scoring.read',
    'scoring.run',
    'reports.read',
    'reports.resolve',
    'merge.read',
    'team.read',
    'audit.read',
    'outreach.read',
    'outreach.write',
    'content.write',
  ],
  CITY_AMBASSADOR: [
    'ambassador.read',
    'ambassador.submit',
    'ambassador.checkin',
    'outreach.read',
    'outreach.write',
  ],
  CONTENT_EDITOR: ['content.write', 'admin.data.read'],
  COMMUNITY_ADMIN: ['organizer.edit', 'organizer.events.write'],
  EVENT_HOST: ['organizer.events.write'],
  PARTNER_ORG_ADMIN: ['organizer.edit', 'organizer.events.write', 'admin.data.read'],
  USER: [],
};

// ─────────────────────────────────────────────────
// SessionUser shape - the subset getSessionUser returns
// ─────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  roleAssignments: Array<{
    role: UserRole;
    cityId: string | null;
    orgId: string | null;
    revokedAt: Date | null;
  }>;
  /** ADR-0008: role-bearing community authority (from CommunityCollaborator). */
  communityMemberships?: CommunityMembership[];
  claimedCommunities?: ReadonlyArray<{ id: string; claimedByUserId?: string | null }>;
};

// ─────────────────────────────────────────────────
// Core helper
// ─────────────────────────────────────────────────

/**
 * Returns true if `user` is allowed to perform `action`.
 *
 * @param user   The authenticated session user (must include roleAssignments).
 * @param action The action to check from the Action catalog.
 * @param scope  Optional city/org scope for scoped roles (e.g. ambassadors).
 */
export function can(
  user: SessionUser | null | undefined,
  action: Action,
  scope?: { cityId?: string; orgId?: string; communityId?: string },
): boolean {
  if (!user) return false;

  // PLATFORM_ADMIN is always granted everything.
  if (user.role === 'PLATFORM_ADMIN') return true;

  // ADR-0008: community-scoped actions delegate to the community-authority
  // helper (CommunityCollaborator), never User.role or the workspace cookie.
  if (scope?.communityId) {
    if (action === 'organizer.edit' || action === 'organizer.events.write') {
      return canEditCommunity(user, scope.communityId);
    }
    // Member-management actions require OWNER/ADMIN.
    return canManageCommunity(user, scope.communityId);
  }

  // Also check active (non-revoked) RoleAssignment rows.
  const activeAssignments = user.roleAssignments.filter((a) => !a.revokedAt);

  // PLATFORM_ADMIN via assignment (edge-case: primary role is something else
  // but they've been assignment-promoted - shouldn't normally happen, but safe).
  if (activeAssignments.some((a) => a.role === 'PLATFORM_ADMIN')) return true;

  for (const assignment of activeAssignments) {
    const allowed = ROLE_ACTIONS[assignment.role] ?? [];
    if (!allowed.includes(action)) continue;

    // V-3 fix (AUDIT-0001): when an action carries a scope, a matching scoped
    // assignment is REQUIRED. Previously an assignment with a null scope
    // silently satisfied any scoped request.
    if (scope?.cityId) {
      if (assignment.cityId !== scope.cityId) continue;
    }
    if (scope?.orgId) {
      if (assignment.orgId !== scope.orgId) continue;
    }

    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────
// Guard helpers for server components / actions
// ─────────────────────────────────────────────────

/**
 * Require that the current session user can perform `action`.
 * Redirects to /admin/login if unauthenticated; throws if unauthorized.
 *
 * Use in server actions where redirect() is not desirable:
 *   await assertCan('pipeline.approve');
 */
export async function assertCan(
  action: Action,
  scope?: { cityId?: string; orgId?: string; communityId?: string },
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user as SessionUser, action, scope)) {
    throw new Error(`Forbidden: missing permission for '${action}'`);
  }
  return user as SessionUser;
}

/**
 * Like assertCan but for pages/layouts that should redirect instead of throw.
 * Redirects to /admin/login if unauthenticated, /admin if unauthorized.
 */
export async function requireCan(
  action: Action,
  scope?: { cityId?: string; orgId?: string; communityId?: string },
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user as SessionUser, action, scope)) redirect('/admin');
  return user as SessionUser;
}

/**
 * Returns the current session user with role assignments loaded,
 * or null. Non-throwing - use where optional auth is needed.
 */
export async function getAuthorizedUser(): Promise<SessionUser | null> {
  return (await getSessionUser()) as SessionUser | null;
}
