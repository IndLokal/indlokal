import { describe, expect, it } from 'vitest';
import {
  buildOrganizerWorkspace,
  getOrganizerWorkspaceRole,
  resolveActiveOrganizerCommunity,
} from '../workspace';

const communities = [
  { id: 'community-a', claimedByUserId: 'user-1' },
  { id: 'community-b', claimedByUserId: 'user-2' },
];

describe('resolveActiveOrganizerCommunity', () => {
  it('returns the cookie-selected community when accessible', () => {
    expect(resolveActiveOrganizerCommunity(communities, 'community-b')).toEqual(communities[1]);
  });

  it('falls back to the first accessible community when cookie is invalid', () => {
    expect(resolveActiveOrganizerCommunity(communities, 'missing-community')).toEqual(
      communities[0],
    );
  });

  it('returns null when no communities are accessible', () => {
    expect(resolveActiveOrganizerCommunity([], 'community-a')).toBeNull();
  });
});

describe('getOrganizerWorkspaceRole', () => {
  it('marks the owner of record as OWNER', () => {
    expect(
      getOrganizerWorkspaceRole({ id: 'user-1', claimedCommunities: communities }, communities[0]),
    ).toBe('COMMUNITY_ADMIN');
  });

  it('marks non-owner access as COLLABORATOR', () => {
    expect(
      getOrganizerWorkspaceRole({ id: 'user-1', claimedCommunities: communities }, communities[1]),
    ).toBe('COLLABORATOR');
  });

  it('uses community membership role when available', () => {
    expect(
      getOrganizerWorkspaceRole(
        {
          id: 'user-1',
          claimedCommunities: communities,
          communityMemberships: [{ communityId: 'community-b', role: 'COMMUNITY_ADMIN' }],
        },
        communities[1],
      ),
    ).toBe('COMMUNITY_ADMIN');
  });
});

describe('buildOrganizerWorkspace', () => {
  it('returns the active community, role, and multi-community flag together', () => {
    expect(
      buildOrganizerWorkspace(
        {
          id: 'user-1',
          claimedCommunities: communities,
        },
        'community-b',
      ),
    ).toEqual({
      community: communities[1],
      role: 'COLLABORATOR',
      isMultiCommunity: true,
    });
  });

  it('returns null role when the user has no accessible communities', () => {
    expect(
      buildOrganizerWorkspace(
        {
          id: 'user-1',
          claimedCommunities: [],
        },
        null,
      ),
    ).toEqual({
      community: null,
      role: null,
      isMultiCommunity: false,
    });
  });
});
