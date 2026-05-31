import { describe, expect, it } from 'vitest';
import { can, type SessionUser } from '../permissions';

function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'u@example.com',
    displayName: null,
    role: 'USER',
    roleAssignments: [],
    communityMemberships: [],
    claimedCommunities: [],
    ...overrides,
  };
}

describe('can() - V-3 scoped-assignment bypass fix', () => {
  it('denies a scoped action when the matching assignment has a null scope', () => {
    const u = sessionUser({
      roleAssignments: [{ role: 'CITY_AMBASSADOR', cityId: null, orgId: null, revokedAt: null }],
    });
    // Before the fix this returned true because a null cityId bypassed the check.
    expect(can(u, 'ambassador.read', { cityId: 'city-x' })).toBe(false);
  });

  it('allows a scoped action when the assignment cityId matches', () => {
    const u = sessionUser({
      roleAssignments: [
        { role: 'CITY_AMBASSADOR', cityId: 'city-x', orgId: null, revokedAt: null },
      ],
    });
    expect(can(u, 'ambassador.read', { cityId: 'city-x' })).toBe(true);
  });

  it('denies a scoped action when the assignment cityId is for a different city', () => {
    const u = sessionUser({
      roleAssignments: [
        { role: 'CITY_AMBASSADOR', cityId: 'city-y', orgId: null, revokedAt: null },
      ],
    });
    expect(can(u, 'ambassador.read', { cityId: 'city-x' })).toBe(false);
  });
});

describe('can() - communityId scope delegation (ADR-0008)', () => {
  it('routes organizer.edit to community edit authority', () => {
    const owner = sessionUser({
      communityMemberships: [{ communityId: 'c1', role: 'COMMUNITY_ADMIN' }],
    });
    const collaborator = sessionUser({
      communityMemberships: [{ communityId: 'c1', role: 'COLLABORATOR' }],
    });
    const outsider = sessionUser();

    expect(can(owner, 'organizer.edit', { communityId: 'c1' })).toBe(true);
    expect(can(collaborator, 'organizer.edit', { communityId: 'c1' })).toBe(true);
    expect(can(outsider, 'organizer.edit', { communityId: 'c1' })).toBe(false);
  });

  it('routes non-edit actions to community management authority (OWNER only)', () => {
    const owner = sessionUser({
      communityMemberships: [{ communityId: 'c1', role: 'COMMUNITY_ADMIN' }],
    });
    const collaborator = sessionUser({
      communityMemberships: [{ communityId: 'c1', role: 'COLLABORATOR' }],
    });

    expect(can(owner, 'team.grant', { communityId: 'c1' })).toBe(true);
    expect(can(collaborator, 'team.grant', { communityId: 'c1' })).toBe(false);
  });

  it('does not leak authority across communities', () => {
    const owner = sessionUser({
      communityMemberships: [{ communityId: 'c1', role: 'COMMUNITY_ADMIN' }],
    });
    expect(can(owner, 'organizer.edit', { communityId: 'c2' })).toBe(false);
  });

  it('grants PLATFORM_ADMIN every community-scoped action', () => {
    const admin = sessionUser({ role: 'PLATFORM_ADMIN' });
    expect(can(admin, 'organizer.edit', { communityId: 'c1' })).toBe(true);
    expect(can(admin, 'team.grant', { communityId: 'c1' })).toBe(true);
  });
});
