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
  approvePublicCollaboratorRequestAction,
  rejectPublicCollaboratorRequestAction,
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
  metadata: Record<string, unknown> | null;
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
          metadata: true,
          user: { select: { email: true, displayName: true } },
          requestedByUser: { select: { email: true, displayName: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  const collaborators: CollaboratorRow[] = (collaboratorData?.collaborators ?? []).map((c) => ({
    ...c,
    metadata: (c.metadata as Record<string, unknown> | null) ?? null,
  }));
  const primaryOwnerUserId = collaboratorData?.claimedBy?.id ?? null;
  const canManageRoles = user.role === 'PLATFORM_ADMIN' || community.claimedByUserId === user.id;
  const canInviteCollaborators = user.role === 'PLATFORM_ADMIN' || role === 'COMMUNITY_ADMIN';
  const activeMembers = collaborators.filter(
    (collaborator) =>
      collaborator.status === 'ACTIVE' && collaborator.userId !== primaryOwnerUserId,
  );
  const pendingInvites = collaborators.filter(
    (collaborator) =>
      collaborator.status === 'PENDING' && collaborator.source === 'COMMUNITY_ADMIN_INVITE',
  );
  const pendingRequests = collaborators.filter(
    (collaborator) => collaborator.status === 'PENDING' && collaborator.source === 'PUBLIC_REQUEST',
  );
  const pageDescription = canManageRoles
    ? 'Primary owner can approve collaborator requests, manage team roles, and transfer ownership. Community admins can invite collaborators.'
    : canInviteCollaborators
      ? 'Community admins can invite collaborators. Role and ownership changes remain owner-only.'
      : 'View who can help operate this community.';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
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
              <h2 className="text-foreground text-lg font-semibold">Pending invites</h2>
              <p className="text-muted mt-1 text-sm">
                Organizer invites waiting for the recipient to accept via the emailed link.
              </p>
            </div>
            <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
              {pendingInvites.length}
            </span>
          </div>

          {pendingInvites.length === 0 ? (
            <p className="text-muted mt-4 text-sm">No pending invites.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pendingInvites.map((collaborator) => (
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
                    </div>
                    <span className="bg-muted-bg text-muted rounded-full px-2 py-1 text-[11px] font-medium">
                      Awaiting acceptance
                    </span>
                  </div>

                  <dl className="mt-3 space-y-2">
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted text-xs tracking-wide uppercase">Invited</dt>
                      <dd className="text-muted">
                        {formatDistanceToNow(collaborator.createdAt, { addSuffix: true })}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        description="This pending invite will be removed. The person will need a new invite later."
                        confirmLabel="Withdraw"
                        tone="danger"
                        triggerClassName="rounded-[var(--radius-button)] border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      />
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canManageRoles ? (
        <section className="card-base p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-foreground text-lg font-semibold">Access requests</h2>
              <p className="text-muted mt-1 text-sm">
                People who found your community page and asked to help run it. Review and approve or
                reject each request — the requester will be notified either way.
              </p>
            </div>
            <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
              {pendingRequests.length}
            </span>
          </div>

          {pendingRequests.length === 0 ? (
            <p className="text-muted mt-4 text-sm">No pending access requests.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pendingRequests.map((collaborator) => {
                const meta = collaborator.metadata;
                const relationship =
                  typeof meta?.relationship === 'string' ? meta.relationship : null;
                const message = typeof meta?.message === 'string' ? meta.message : null;
                return (
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
                            'Requester'}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">
                          {collaborator.user.email ??
                            collaborator.requestedEmail ??
                            'No email on file'}
                        </p>
                      </div>
                      <span className="rounded-full bg-yellow-50 px-2 py-1 text-[11px] font-medium text-yellow-700">
                        Needs review
                      </span>
                    </div>

                    <dl className="mt-3 space-y-2">
                      {relationship ? (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                          <dt className="text-muted text-xs tracking-wide uppercase">Role</dt>
                          <dd className="text-muted">{relationship}</dd>
                        </div>
                      ) : null}
                      {message ? (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                          <dt className="text-muted text-xs tracking-wide uppercase">Note</dt>
                          <dd className="text-muted italic">&quot;{message}&quot;</dd>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                        <dt className="text-muted text-xs tracking-wide uppercase">Requested</dt>
                        <dd className="text-muted">
                          {formatDistanceToNow(collaborator.createdAt, { addSuffix: true })}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={approvePublicCollaboratorRequestAction}>
                        <input type="hidden" name="collaboratorId" value={collaborator.id} />
                        <ConfirmSubmitButton
                          triggerLabel="Approve"
                          title="Approve collaborator request?"
                          description="This person will be added as a collaborator and notified by email. They will be able to log into the organizer workspace for this community."
                          confirmLabel="Approve"
                          tone="primary"
                          triggerClassName="btn-secondary border-green-400 px-3 py-1.5 text-xs text-green-800 hover:bg-green-50"
                        />
                      </form>
                      <form action={rejectPublicCollaboratorRequestAction}>
                        <input type="hidden" name="collaboratorId" value={collaborator.id} />
                        <ConfirmSubmitButton
                          triggerLabel="Reject"
                          title="Reject collaborator request?"
                          description="The requester will be notified that their request was not approved."
                          confirmLabel="Reject"
                          tone="danger"
                          triggerClassName="rounded-[var(--radius-button)] border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        />
                      </form>
                    </div>
                  </article>
                );
              })}
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
