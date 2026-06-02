import { formatDistanceToNow } from 'date-fns';
import type { ReactElement } from 'react';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { ConfirmSubmitButton } from '@/components/ui';
import { CollaboratorInviteCard } from '../CollaboratorInviteCard';
import {
  demoteAdminToCollaboratorAction,
  promoteCollaboratorToAdminAction,
  removeCollaboratorAction,
  resendCollaboratorInviteAction,
  transferOwnershipAction,
  withdrawCollaboratorInviteAction,
} from './actions';

export const metadata = { title: 'Collaborators - Organizer' };

function sourceLabel(source: 'COMMUNITY_ADMIN_INVITE' | 'PUBLIC_REQUEST' | 'ADMIN_ADD') {
  if (source === 'COMMUNITY_ADMIN_INVITE') return 'Organizer invite';
  if (source === 'PUBLIC_REQUEST') return 'Public request';
  return 'Admin add';
}

function roleLabel(role: 'COMMUNITY_ADMIN' | 'COLLABORATOR') {
  return role === 'COMMUNITY_ADMIN' ? 'Community admin' : 'Collaborator';
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

function renderCollaboratorActions(
  collaborator: CollaboratorRow,
  canManageTeam: boolean,
): ReactElement | null {
  if (!canManageTeam) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {collaborator.role === 'COLLABORATOR' ? (
        <>
          <form action={promoteCollaboratorToAdminAction}>
            <input type="hidden" name="targetUserId" value={collaborator.userId} />
            <ConfirmSubmitButton
              triggerLabel="Promote to admin"
              title="Promote collaborator to admin?"
              description="Admins can invite collaborators and help operate the workspace. Ownership still remains with the primary owner."
              confirmLabel="Promote"
              tone="primary"
              triggerClassName="btn-secondary px-3 py-1.5 text-xs"
            />
          </form>
          <form action={transferOwnershipAction}>
            <input type="hidden" name="targetUserId" value={collaborator.userId} />
            <ConfirmSubmitButton
              triggerLabel="Make primary owner"
              title="Transfer primary ownership?"
              description="This will make this person the primary owner and demote the current owner to collaborator."
              confirmLabel="Transfer"
              tone="danger"
              triggerClassName="btn-secondary px-3 py-1.5 text-xs"
            />
          </form>
        </>
      ) : (
        <form action={demoteAdminToCollaboratorAction}>
          <input type="hidden" name="targetUserId" value={collaborator.userId} />
          <ConfirmSubmitButton
            triggerLabel="Demote to collaborator"
            title="Demote admin to collaborator?"
            description="They will lose admin-level capabilities and keep collaborator access only."
            confirmLabel="Demote"
            tone="danger"
            triggerClassName="btn-secondary px-3 py-1.5 text-xs"
          />
        </form>
      )}
      <form action={removeCollaboratorAction}>
        <input type="hidden" name="collaboratorId" value={collaborator.id} />
        <ConfirmSubmitButton
          triggerLabel="Remove"
          title="Remove collaborator from team?"
          description="This person will lose workspace access for this community."
          confirmLabel="Remove"
          tone="danger"
          triggerClassName="rounded-[var(--radius-button)] border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        />
      </form>
    </div>
  );
}

export default async function OrganizerCollaboratorsPage() {
  const { community, role, isMultiCommunity, user } = await requireOrganizerWorkspace();

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
  const primaryOwnerUserId = collaboratorData?.claimedBy?.id ?? null;
  const canManageRoles = user.role === 'PLATFORM_ADMIN' || community.claimedByUserId === user.id;
  const canInviteCollaborators = user.role === 'PLATFORM_ADMIN' || role === 'COMMUNITY_ADMIN';
  const activeMembers = collaborators.filter(
    (collaborator) =>
      collaborator.status === 'ACTIVE' && collaborator.userId !== primaryOwnerUserId,
  );
  const pendingCollaborators = collaborators.filter(
    (collaborator) => collaborator.status === 'PENDING',
  );
  const pageDescription = canManageRoles
    ? 'Primary owner can manage team roles and ownership transfer. Community admins can invite collaborators.'
    : canInviteCollaborators
      ? 'Community admins can invite collaborators. Role and ownership changes remain owner-only.'
      : 'View who can help operate this community.';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OrganizerPageHeader title="Team" description={pageDescription} />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />

      <section className="card-base p-6">
        <h2 className="text-foreground text-lg font-semibold">Primary community owner</h2>
        <p className="text-muted mt-1 text-sm">
          Ownership stays separate from team membership. The primary owner is the only person who
          can promote, demote, remove, or transfer access.
        </p>
        <div className="border-border mt-4 rounded-[var(--radius-button)] border bg-white px-4 py-3 text-sm">
          <p className="text-foreground font-medium">
            {collaboratorData?.claimedBy?.displayName ??
              collaboratorData?.claimedBy?.email ??
              'No community owner on record'}
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
              {canManageRoles
                ? 'Active admins and collaborators for this community. Only the primary owner can change access.'
                : canInviteCollaborators
                  ? 'Active admins and collaborators for this community. Community admins can invite collaborators.'
                  : 'People who can already access this organizer workspace.'}
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {activeMembers.length}
          </span>
        </div>

        {activeMembers.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No active team members yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeMembers.map((collaborator) => (
              <article
                key={collaborator.id}
                className="border-border rounded-[var(--radius-card)] border bg-white p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-medium">
                      {collaborator.user.displayName ??
                        collaborator.user.email ??
                        collaborator.requestedEmail ??
                        'Team member'}
                    </p>
                    <p className="text-muted mt-0.5 text-xs">
                      {collaborator.user.email ?? collaborator.requestedEmail ?? 'No email on file'}
                    </p>
                  </div>
                  <span className="bg-muted-bg text-muted rounded-full px-2 py-1 text-[11px] font-medium">
                    {roleLabel(collaborator.role)}
                  </span>
                </div>

                <dl className="mt-3 space-y-2">
                  <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                    <dt className="text-muted text-xs tracking-wide uppercase">Source</dt>
                    <dd className="text-muted">{sourceLabel(collaborator.source)}</dd>
                  </div>
                  <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                    <dt className="text-muted text-xs tracking-wide uppercase">Approved</dt>
                    <dd className="text-muted">
                      {collaborator.reviewedAt
                        ? formatDistanceToNow(collaborator.reviewedAt, { addSuffix: true })
                        : 'Recently approved'}
                    </dd>
                  </div>
                </dl>

                {renderCollaboratorActions(collaborator, canManageRoles)}
              </article>
            ))}
          </div>
        )}
      </section>

      {canInviteCollaborators ? (
        <section className="card-base p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-foreground text-lg font-semibold">Pending requests</h2>
              <p className="text-muted mt-1 text-sm">
                Pending organizer invites need acceptance. Public help requests are reviewed on the
                admin collaborators page.
              </p>
            </div>
            <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
              {pendingCollaborators.length}
            </span>
          </div>

          {pendingCollaborators.length === 0 ? (
            <p className="text-muted mt-4 text-sm">No pending organizer invites.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pendingCollaborators.map((collaborator) => (
                <article
                  key={collaborator.id}
                  className="border-border rounded-[var(--radius-card)] border bg-white p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
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
                    </div>
                    <span className="bg-muted-bg text-muted rounded-full px-2 py-1 text-[11px] font-medium">
                      {collaborator.source === 'COMMUNITY_ADMIN_INVITE'
                        ? 'Awaiting invite acceptance'
                        : 'Awaiting review'}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-2">
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted text-xs tracking-wide uppercase">Source</dt>
                      <dd className="text-muted">{sourceLabel(collaborator.source)}</dd>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted text-xs tracking-wide uppercase">Requested</dt>
                      <dd className="text-muted">
                        {formatDistanceToNow(collaborator.createdAt, { addSuffix: true })}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    {collaborator.source === 'COMMUNITY_ADMIN_INVITE' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={resendCollaboratorInviteAction}>
                          <input type="hidden" name="collaboratorId" value={collaborator.id} />
                          <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                            Resend invite
                          </button>
                        </form>
                        <form action={withdrawCollaboratorInviteAction}>
                          <input type="hidden" name="collaboratorId" value={collaborator.id} />
                          <ConfirmSubmitButton
                            triggerLabel="Withdraw invite"
                            title="Withdraw pending invite?"
                            description="This pending invite will be removed from the queue and the person will need a new invite later."
                            confirmLabel="Withdraw"
                            tone="danger"
                            triggerClassName="rounded-[var(--radius-button)] border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          />
                        </form>
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canInviteCollaborators ? (
        <CollaboratorInviteCard
          title="Invite collaborator"
          description="Send an invite by email. Collaborator access becomes active when they accept the invite link."
        />
      ) : null}
    </div>
  );
}
