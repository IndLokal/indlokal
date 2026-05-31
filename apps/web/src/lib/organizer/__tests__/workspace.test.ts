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
    expect(getOrganizerWorkspaceRole('user-1', communities[0])).toBe('COMMUNITY_ADMIN');
  });

  it('marks non-owner access as COLLABORATOR', () => {
    expect(getOrganizerWorkspaceRole('user-1', communities[1])).toBe('COLLABORATOR');
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
