import { formatDistanceToNow } from 'date-fns';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { CollaboratorInviteCard } from '../CollaboratorInviteCard';
import {
  promoteCollaboratorToAdminAction,
  removeCollaboratorAction,
  resendCollaboratorInviteAction,
  transferOwnershipAction,
} from './actions';

export const metadata = { title: 'Collaborators - Organizer' };

function sourceLabel(source: 'COMMUNITY_ADMIN_INVITE' | 'PUBLIC_REQUEST' | 'ADMIN_ADD') {
  if (source === 'COMMUNITY_ADMIN_INVITE') return 'Organizer invite';
  if (source === 'PUBLIC_REQUEST') return 'Public request';
  return 'Admin add';
}

function roleLabel(role: 'COMMUNITY_ADMIN' | 'COLLABORATOR') {
  if (role === 'COMMUNITY_ADMIN') return 'Community admin';
  return 'Collaborator';
}

type CollaboratorRow = {
  id: string;
  userId: string;
  role: 'COMMUNITY_ADMIN' | 'COLLABORATOR';
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'REMOVED';
  source: 'COMMUNITY_ADMIN_INVITE' | 'PUBLIC_REQUEST' | 'ADMIN_ADD';
  requestedEmail: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  user: { email: string; displayName: string | null };
  requestedByUser: { email: string; displayName: string | null } | null;
};

export default async function OrganizerCollaboratorsPage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  const collaboratorData = await db.community.findUnique({
    where: { id: community.id },
    select: {
      claimedBy: { select: { id: true, email: true, displayName: true } },
      collaborators: {
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          source: true,
          requestedEmail: true,
          createdAt: true,
          reviewedAt: true,
          user: { select: { email: true, displayName: true } },
          requestedByUser: { select: { email: true, displayName: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  const collaborators: CollaboratorRow[] = collaboratorData?.collaborators ?? [];
  const primaryAdminUserId = collaboratorData?.claimedBy?.id ?? null;
  const canManageTeam = role === 'COMMUNITY_ADMIN';
  const activeMembers = collaborators.filter(
    (collaborator: CollaboratorRow) =>
      collaborator.status === 'ACTIVE' && collaborator.userId !== primaryAdminUserId,
  );
  const pendingCollaborators = collaborators.filter(
    (collaborator: CollaboratorRow) => collaborator.status === 'PENDING',
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OrganizerPageHeader
        title="Team"
        description="Manage who can help operate this community and track pending access requests."
      />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />

      <section className="card-base p-6">
        <h2 className="text-foreground text-lg font-semibold">Primary community admin</h2>
        <p className="text-muted mt-1 text-sm">
          Ownership remains separate from collaborator access. Use Transfer ownership when needed.
        </p>
        <div className="border-border mt-4 rounded-[var(--radius-button)] border bg-white px-4 py-3 text-sm">
          <p className="text-foreground font-medium">
            {collaboratorData?.claimedBy?.displayName ??
              collaboratorData?.claimedBy?.email ??
              'No community admin on record'}
          </p>
          {collaboratorData?.claimedBy?.email && (
            <p className="text-muted mt-1">{collaboratorData.claimedBy.email}</p>
          )}
        </div>
      </section>

      <section className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Active team</h2>
            <p className="text-muted mt-1 text-sm">
              People who can already access this organizer workspace, excluding the primary admin
              shown above.
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {activeMembers.length}
          </span>
        </div>

        {activeMembers.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No active team members yet.</p>
        ) : (
          <>
            {canManageTeam ? (
              <p className="text-muted mt-3 text-xs">
                Grant admin access adds admin permissions. Transfer ownership changes the primary
                admin. Remove cannot remove the primary admin directly.
              </p>
            ) : null}

            <div className="border-border mt-4 max-h-[26rem] overflow-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-muted-bg text-left">
                  <tr className="border-border border-b">
                    <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                      Member
                    </th>
                    <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                      Role
                    </th>
                    <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                      Source
                    </th>
                    <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                      Approved
                    </th>
                    {canManageTeam ? (
                      <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                        Action
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {activeMembers.map((collaborator: CollaboratorRow) => {
                    return (
                      <tr key={collaborator.id}>
                        <td className="px-4 py-3">
                          <p className="text-foreground font-medium">
                            {collaborator.user.displayName ?? collaborator.user.email}
                          </p>
                          <p className="text-muted mt-0.5 text-xs">{collaborator.user.email}</p>
                        </td>
                        <td className="text-muted px-4 py-3 text-sm">
                          {roleLabel(collaborator.role)}
                        </td>
                        <td className="text-muted px-4 py-3 text-sm">
                          {sourceLabel(collaborator.source)}
                        </td>
                        <td className="text-muted px-4 py-3 text-sm">
                          {collaborator.reviewedAt
                            ? formatDistanceToNow(collaborator.reviewedAt, { addSuffix: true })
                            : 'Recently approved'}
                        </td>
                        {canManageTeam ? (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              {collaborator.role === 'COLLABORATOR' ? (
                                <>
                                  <form action={promoteCollaboratorToAdminAction}>
                                    <input
                                      type="hidden"
                                      name="targetUserId"
                                      value={collaborator.userId}
                                    />
                                    <button
                                      type="submit"
                                      className="btn-secondary px-3 py-1.5 text-xs"
                                    >
                                      Grant admin access
                                    </button>
                                  </form>
                                  <form action={transferOwnershipAction}>
                                    <input
                                      type="hidden"
                                      name="targetUserId"
                                      value={collaborator.userId}
                                    />
                                    <button
                                      type="submit"
                                      className="btn-secondary px-3 py-1.5 text-xs"
                                    >
                                      Transfer ownership
                                    </button>
                                  </form>
                                </>
                              ) : null}

                              <form action={removeCollaboratorAction}>
                                <input
                                  type="hidden"
                                  name="collaboratorId"
                                  value={collaborator.id}
                                />
                                <button
                                  type="submit"
                                  className="rounded-[var(--radius-button)] border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              </form>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Pending requests</h2>
            <p className="text-muted mt-1 text-sm">
              Requests here are waiting for collaborator acceptance or platform review.
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {pendingCollaborators.length}
          </span>
        </div>

        {pendingCollaborators.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No pending collaborator requests.</p>
        ) : (
          <div className="border-border mt-4 max-h-[26rem] overflow-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted-bg text-left">
                <tr className="border-border border-b">
                  <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Requested access for
                  </th>
                  <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Source
                  </th>
                  <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Requested
                  </th>
                  <th className="bg-muted-bg text-muted sticky top-0 px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {pendingCollaborators.map((collaborator: CollaboratorRow) => (
                  <tr key={collaborator.id}>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">
                        {collaborator.user.displayName ??
                          collaborator.user.email ??
                          collaborator.requestedEmail ??
                          'Pending collaborator'}
                      </p>
                      <p className="text-muted mt-0.5 text-xs">
                        {collaborator.user.email ?? collaborator.requestedEmail ?? 'Awaiting email'}
                      </p>
                      {collaborator.requestedByUser?.email && (
                        <p className="text-muted mt-1 text-xs">
                          Requested by{' '}
                          {collaborator.requestedByUser.displayName ??
                            collaborator.requestedByUser.email}
                        </p>
                      )}
                      <p className="text-muted mt-1 text-xs">
                        {collaborator.source === 'COMMUNITY_ADMIN_INVITE'
                          ? 'Awaiting collaborator email confirmation'
                          : 'Awaiting platform review'}
                      </p>
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {sourceLabel(collaborator.source)}
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {formatDistanceToNow(collaborator.createdAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {collaborator.source === 'COMMUNITY_ADMIN_INVITE' ? (
                        <form action={resendCollaboratorInviteAction}>
                          <input type="hidden" name="collaboratorId" value={collaborator.id} />
                          <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                            Resend invite
                          </button>
                        </form>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CollaboratorInviteCard
        title="Invite collaborator"
        description="Send an invite by email. Collaborator access becomes active when they accept the invite link."
      />
    </div>
  );
}
