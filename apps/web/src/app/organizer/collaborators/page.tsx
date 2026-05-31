import { formatDistanceToNow } from 'date-fns';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { CollaboratorInviteCard } from '../CollaboratorInviteCard';

export const metadata = { title: 'Collaborators - Organizer' };

function sourceLabel(source: 'COMMUNITY_ADMIN_INVITE' | 'PUBLIC_REQUEST' | 'ADMIN_ADD') {
  if (source === 'COMMUNITY_ADMIN_INVITE') return 'Organizer invite';
  if (source === 'PUBLIC_REQUEST') return 'Public request';
  return 'Admin add';
}

type CollaboratorRow = {
  id: string;
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
      claimedBy: { select: { email: true, displayName: true } },
      collaborators: {
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        select: {
          id: true,
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
  const activeCollaborators = collaborators.filter(
    (collaborator: CollaboratorRow) => collaborator.status === 'ACTIVE',
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
          Ownership remains separate from collaborator access. Admin handles ownership transfer.
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
            <h2 className="text-foreground text-lg font-semibold">Active collaborators</h2>
            <p className="text-muted mt-1 text-sm">
              People who can already access this organizer workspace.
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {activeCollaborators.length}
          </span>
        </div>

        {activeCollaborators.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No active collaborators yet.</p>
        ) : (
          <div className="border-border mt-4 overflow-x-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted-bg text-left">
                <tr className="border-border border-b">
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Collaborator
                  </th>
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Source
                  </th>
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Approved
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {activeCollaborators.map((collaborator: CollaboratorRow) => (
                  <tr key={collaborator.id}>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">
                        {collaborator.user.displayName ?? collaborator.user.email}
                      </p>
                      <p className="text-muted mt-0.5 text-xs">{collaborator.user.email}</p>
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {sourceLabel(collaborator.source)}
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {collaborator.reviewedAt
                        ? formatDistanceToNow(collaborator.reviewedAt, { addSuffix: true })
                        : 'Recently approved'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Pending requests</h2>
            <p className="text-muted mt-1 text-sm">
              Pending collaborator requests stay here until reviewed by admin.
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {pendingCollaborators.length}
          </span>
        </div>

        {pendingCollaborators.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No pending collaborator requests.</p>
        ) : (
          <div className="border-border mt-4 overflow-x-auto rounded-[var(--radius-card)] border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted-bg text-left">
                <tr className="border-border border-b">
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Requested access for
                  </th>
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Source
                  </th>
                  <th className="text-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
                    Requested
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
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {sourceLabel(collaborator.source)}
                    </td>
                    <td className="text-muted px-4 py-3 text-sm">
                      {formatDistanceToNow(collaborator.createdAt, { addSuffix: true })}
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
        description="Send a collaborator access request by email. Admin review is required before access becomes active."
      />
    </div>
  );
}
