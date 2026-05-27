import { getCurrentCommunityId, requireSessionUser } from '@/lib/session';

export type OrganizerWorkspaceRole = 'OWNER' | 'COLLABORATOR';
export type OrganizerSessionUser = Awaited<ReturnType<typeof requireSessionUser>>;
export type OrganizerSessionCommunity = OrganizerSessionUser['claimedCommunities'][number];

type OrganizerCommunityLike = {
  id: string;
  claimedByUserId: string | null;
};

type OrganizerUserLike<TCommunity extends OrganizerCommunityLike> = {
  id: string;
  claimedCommunities: readonly TCommunity[];
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

export function getOrganizerWorkspaceRole<TCommunity extends OrganizerCommunityLike>(
  userId: string,
  community: TCommunity,
): OrganizerWorkspaceRole {
  return community.claimedByUserId === userId ? 'OWNER' : 'COLLABORATOR';
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
    role: community ? getOrganizerWorkspaceRole(user.id, community) : null,
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
