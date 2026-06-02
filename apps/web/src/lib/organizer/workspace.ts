import { getCurrentCommunityId, requireSessionUser } from '@/lib/session';

export type OrganizerWorkspaceRole = 'COMMUNITY_ADMIN' | 'COLLABORATOR';
export type OrganizerSessionUser = Awaited<ReturnType<typeof requireSessionUser>>;
export type OrganizerSessionCommunity = OrganizerSessionUser['claimedCommunities'][number];

type OrganizerCommunityLike = {
  id: string;
  claimedByUserId: string | null;
};

type OrganizerMembershipLike = {
  communityId: string;
  role: OrganizerWorkspaceRole;
};

type OrganizerUserLike<TCommunity extends OrganizerCommunityLike> = {
  id: string;
  claimedCommunities: readonly TCommunity[];
  communityMemberships?: readonly OrganizerMembershipLike[];
};

export function resolveActiveOrganizerCommunity<TCommunity extends OrganizerCommunityLike>(
  communities: readonly TCommunity[],
  activeCommunityId: string | null,
): TCommunity | null {
  if (communities.length === 0) return null;

  if (activeCommunityId) {
    const matched = communities.find((community) => community.id === activeCommunityId);
    if (matched) return matched;
  }

  return communities[0] ?? null;
}

export function getOrganizerWorkspaceRole<
  TCommunity extends OrganizerCommunityLike,
  TUser extends OrganizerUserLike<TCommunity>,
>(user: TUser, community: TCommunity): OrganizerWorkspaceRole {
  const membershipRole = user.communityMemberships?.find(
    (membership) => membership.communityId === community.id,
  )?.role;

  if (membershipRole) return membershipRole;
  return community.claimedByUserId === user.id ? 'COMMUNITY_ADMIN' : 'COLLABORATOR';
}

export function buildOrganizerWorkspace<TCommunity extends OrganizerCommunityLike>(
  user: OrganizerUserLike<TCommunity>,
  activeCommunityId: string | null,
): {
  community: TCommunity | null;
  role: OrganizerWorkspaceRole | null;
  isMultiCommunity: boolean;
} {
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, activeCommunityId);

  return {
    community,
    role: community ? getOrganizerWorkspaceRole(user, community) : null,
    isMultiCommunity: user.claimedCommunities.length > 1,
  };
}

export async function requireOrganizerWorkspace(): Promise<{
  user: OrganizerSessionUser;
  activeCommunityId: string | null;
  community: OrganizerSessionCommunity | null;
  role: OrganizerWorkspaceRole | null;
  isMultiCommunity: boolean;
}> {
  const user = await requireSessionUser();
  const activeCommunityId = await getCurrentCommunityId();
  const workspace = buildOrganizerWorkspace<OrganizerSessionCommunity>(user, activeCommunityId);

  return {
    user,
    activeCommunityId,
    ...workspace,
  };
}
