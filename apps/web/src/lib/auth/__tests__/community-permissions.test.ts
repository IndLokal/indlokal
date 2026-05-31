import { describe, expect, it } from 'vitest';
import {
  assertCommunity,
  canEditCommunity,
  canManageCommunity,
  getCommunityRole,
  isCommunityOwner,
  type CommunityAuthorityUser,
} from '../community-permissions';

const COMMUNITY = 'community-1';
const OTHER = 'community-2';

function user(overrides: Partial<CommunityAuthorityUser> = {}): CommunityAuthorityUser {
  return {
    id: 'user-1',
    role: 'USER',
    communityMemberships: [],
    claimedCommunities: [],
    ...overrides,
  };
}

describe('getCommunityRole', () => {
  it('returns the membership role for the matching community', () => {
    const u = user({ communityMemberships: [{ communityId: COMMUNITY, role: 'COLLABORATOR' }] });
    expect(getCommunityRole(u, COMMUNITY)).toBe('COLLABORATOR');
  });

  it('returns null when the user has no membership for the community', () => {
    const u = user({ communityMemberships: [{ communityId: OTHER, role: 'COMMUNITY_ADMIN' }] });
    expect(getCommunityRole(u, COMMUNITY)).toBeNull();
  });

  it('returns null for an anonymous user', () => {
    expect(getCommunityRole(null, COMMUNITY)).toBeNull();
  });

  it('falls back to OWNER for a claimed owner without a backfilled membership row', () => {
    const u = user({
      claimedCommunities: [{ id: COMMUNITY, claimedByUserId: 'user-1' }],
    });
    expect(getCommunityRole(u, COMMUNITY)).toBe('COMMUNITY_ADMIN');
  });

  it('does not grant OWNER fallback when claimedByUserId is someone else', () => {
    const u = user({
      claimedCommunities: [{ id: COMMUNITY, claimedByUserId: 'user-2' }],
    });
    expect(getCommunityRole(u, COMMUNITY)).toBeNull();
  });
});

describe('authority matrices', () => {
  const cases: Array<{
    role: 'COMMUNITY_ADMIN' | 'COLLABORATOR';
    owner: boolean;
    manage: boolean;
    edit: boolean;
  }> = [
    { role: 'COMMUNITY_ADMIN', owner: true, manage: true, edit: true },
    { role: 'COLLABORATOR', owner: false, manage: false, edit: true },
  ];

  for (const c of cases) {
    it(`${c.role}: owner=${c.owner} manage=${c.manage} edit=${c.edit}`, () => {
      const u = user({ communityMemberships: [{ communityId: COMMUNITY, role: c.role }] });
      expect(isCommunityOwner(u, COMMUNITY)).toBe(c.owner);
      expect(canManageCommunity(u, COMMUNITY)).toBe(c.manage);
      expect(canEditCommunity(u, COMMUNITY)).toBe(c.edit);
    });
  }

  it('denies all authority to non-members', () => {
    const u = user();
    expect(isCommunityOwner(u, COMMUNITY)).toBe(false);
    expect(canManageCommunity(u, COMMUNITY)).toBe(false);
    expect(canEditCommunity(u, COMMUNITY)).toBe(false);
  });
});

describe('PLATFORM_ADMIN fast-path', () => {
  it('grants every level regardless of membership', () => {
    const u = user({ role: 'PLATFORM_ADMIN' });
    expect(isCommunityOwner(u, COMMUNITY)).toBe(true);
    expect(canManageCommunity(u, COMMUNITY)).toBe(true);
    expect(canEditCommunity(u, COMMUNITY)).toBe(true);
  });
});

describe('assertCommunity', () => {
  it('throws Forbidden when the user lacks the level', () => {
    const u = user({ communityMemberships: [{ communityId: COMMUNITY, role: 'COLLABORATOR' }] });
    expect(() => assertCommunity(u, COMMUNITY, 'manage')).toThrowError(/Forbidden/);
  });

  it('does not throw when the user meets the level', () => {
    const u = user({ communityMemberships: [{ communityId: COMMUNITY, role: 'COMMUNITY_ADMIN' }] });
    expect(() => assertCommunity(u, COMMUNITY, 'manage')).not.toThrow();
  });
});
