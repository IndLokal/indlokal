import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { canInviteCommunityCollaborators } from '@/lib/auth/community-permissions';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { ACTIVE_BUSINESS_CONNECT_PILOT } from '@/app/jito-stuttgart/business-connect/pilot';
import {
  BUSINESS_CONNECT_STATUSES,
  LOOKING_FOR_LABELS,
  OFFERING_LABELS,
  PARTICIPANT_TYPE_LABELS,
  YES_NO_NOT_SURE_LABELS,
} from '@/app/jito-stuttgart/business-connect/options';
import { BusinessConnectInviteCard } from './BusinessConnectInviteCard';
import { updateBusinessConnectNotes, updateBusinessConnectStatus } from './actions';

export const metadata = { title: 'Business Connect - Organizer' };

const pilot = ACTIVE_BUSINESS_CONNECT_PILOT;

type InviteStatus = { label: string; tone: 'pending' | 'used' | 'expired' };

function inviteStatus(invite: {
  usedAt: Date | null;
  expiresAt: Date;
  submission: { status: string } | null;
}): InviteStatus {
  if (invite.usedAt) {
    const submitted = invite.submission?.status;
    if (submitted === 'PENDING_CONFIRMATION') {
      return { label: 'Submitted · awaiting email confirmation', tone: 'used' };
    }
    return { label: 'Submitted · in review', tone: 'used' };
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return { label: 'Expired', tone: 'expired' };
  }
  return { label: 'Awaiting submission', tone: 'pending' };
}

const TONE_CLASS: Record<InviteStatus['tone'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  used: 'bg-green-50 text-green-700',
  expired: 'bg-muted-bg text-muted',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-700',
  REVIEWED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  MATCHED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

function labelList(values: string[], map: Record<string, string>): string {
  if (!values || values.length === 0) return '—';
  return values.map((value) => map[value] ?? value).join(', ');
}

export default async function OrganizerBusinessConnectPage() {
  const { user, community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  // Invite-only Business Connect is scoped to the pilot's own community.
  if (!community || community.slug !== pilot.communitySlug) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <OrganizerPageHeader
          title="Business Connect"
          description="Invite-only enquiry intake for the Business Connect pilot."
        />
        <div className="card-base p-6">
          <p className="text-muted text-sm">
            Business Connect is not available for this community. It is currently running with{' '}
            {pilot.partnerName} only.
          </p>
        </div>
      </div>
    );
  }

  const canInvite = canInviteCommunityCollaborators(user, community.id);
  const canReview = canInvite;

  const invites = await db.businessConnectInvite.findMany({
    where: { communityId: community.id, pilotSlug: pilot.slug },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      submission: { select: { status: true } },
    },
  });

  const outstandingInvites = invites.filter((invite) => !invite.usedAt);
  const submittedInviteCount = invites.length - outstandingInvites.length;

  const submissions = await db.businessConnectSubmission.findMany({
    where: {
      pilotSlug: pilot.slug,
      status: { not: 'PENDING_CONFIRMATION' },
      invite: { communityId: community.id },
    },
    orderBy: { createdAt: 'desc' },
  });

  type SubmissionRow = (typeof submissions)[number];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <OrganizerPageHeader
        title="Business Connect"
        description={`Invite-only enquiry intake for the ${pilot.eventLabel}. You choose who can submit; IndLokal reviews every enquiry manually.`}
      />
      <div className="flex justify-end">
        <Link
          href="/jito-stuttgart/business-connect/submit?preview=1"
          className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-3 py-2 text-xs font-medium"
        >
          Preview enquiry form
        </Link>
      </div>
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />

      {canInvite ? (
        <BusinessConnectInviteCard />
      ) : (
        <div className="card-base p-6">
          <p className="text-muted text-sm">
            Only community admins can invite Business Connect guests. Ask the primary owner to
            invite you as an admin if you need this.
          </p>
        </div>
      )}

      <section className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Outstanding invites</h2>
            <p className="text-muted mt-1 text-[15px] leading-relaxed">
              Guests who have not submitted yet (including expired invites).
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {outstandingInvites.length}
          </span>
        </div>

        {outstandingInvites.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No outstanding invites.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {outstandingInvites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <li
                  key={invite.id}
                  className="border-border flex h-full flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground text-lg font-semibold break-all">
                      {invite.email}
                    </p>
                    {invite.note ? (
                      <p className="text-muted mt-0.5 text-xs">{invite.note}</p>
                    ) : null}
                    <p className="text-muted mt-1 text-xs">
                      Invited {formatDistanceToNow(invite.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${TONE_CLASS[status.tone]}`}
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {submittedInviteCount > 0 ? (
          <p className="text-muted mt-3 text-sm leading-relaxed">
            {submittedInviteCount} {submittedInviteCount === 1 ? 'invite has' : 'invites have'}
            already submitted and {submittedInviteCount === 1 ? 'is' : 'are'} listed in
            &nbsp;&quot;Submitted enquiries&quot; below.
          </p>
        ) : null}
      </section>

      <section className="card-base p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Submitted enquiries</h2>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              The JITO organizer team reviews these submissions and decides what gets shortlisted.
            </p>
          </div>
          <span className="bg-muted-bg text-muted rounded-full px-2.5 py-1 text-xs font-medium">
            {submissions.length}
          </span>
        </div>

        {submissions.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No confirmed enquiries yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {submissions.map((submission: SubmissionRow) => (
              <div
                key={submission.id}
                className="border-border h-full rounded-[var(--radius-card)] border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${STATUS_COLORS[submission.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {submission.status}
                      </span>
                      <span className="bg-muted-bg text-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {PARTICIPANT_TYPE_LABELS[submission.participantType] ??
                          submission.participantType}
                      </span>
                      <span className="text-muted text-[11px]">
                        {formatDistanceToNow(submission.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-foreground mt-2 text-sm font-semibold">
                      {submission.companyName}
                    </p>
                    <p className="text-muted text-xs">
                      {submission.city}, {submission.country} · {submission.industry}
                    </p>
                  </div>

                  {canReview ? (
                    <form action={updateBusinessConnectStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={submission.id} />
                      <select
                        name="status"
                        defaultValue={submission.status}
                        className="border-border rounded-[var(--radius-button)] border bg-white px-2 py-1 text-xs"
                      >
                        {BUSINESS_CONNECT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-3 py-1 text-xs font-medium"
                      >
                        Update
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="text-muted mt-3 grid grid-cols-1 gap-2 text-xs leading-relaxed sm:grid-cols-2">
                  <p>
                    <span className="text-foreground font-medium">Looking for:</span>{' '}
                    {labelList(submission.lookingFor, LOOKING_FOR_LABELS)}
                    {submission.lookingForOther ? ` (${submission.lookingForOther})` : ''}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Offering:</span>{' '}
                    {labelList(submission.offering, OFFERING_LABELS)}
                    {submission.offeringOther ? ` (${submission.offeringOther})` : ''}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Attending:</span>{' '}
                    {YES_NO_NOT_SURE_LABELS[submission.attendingEvent] ?? submission.attendingEvent}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Member:</span>{' '}
                    {YES_NO_NOT_SURE_LABELS[submission.isPartnerMember] ??
                      submission.isPartnerMember}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Contact:</span>{' '}
                    {submission.contactName} ·{' '}
                    <a
                      href={`mailto:${submission.contactEmail}`}
                      className="text-brand-700 hover:underline"
                    >
                      {submission.contactEmail}
                    </a>
                  </p>
                </div>

                <details className="mt-3">
                  <summary className="text-brand-700 cursor-pointer text-xs font-semibold">
                    View full enquiry
                  </summary>
                  <div className="text-muted mt-3 space-y-2 text-xs">
                    <p>
                      <span className="text-foreground font-medium">Business description:</span>{' '}
                      {submission.businessDescription}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Specific ask:</span>{' '}
                      {submission.specificAsk}
                    </p>
                    {submission.website ? (
                      <p>
                        <span className="text-foreground font-medium">Website:</span>{' '}
                        {submission.website}
                      </p>
                    ) : null}
                    {submission.linkedinUrl ? (
                      <p>
                        <span className="text-foreground font-medium">LinkedIn:</span>{' '}
                        {submission.linkedinUrl}
                      </p>
                    ) : null}
                    {submission.phone ? (
                      <p>
                        <span className="text-foreground font-medium">Phone / WhatsApp:</span>{' '}
                        {submission.phone}
                      </p>
                    ) : null}
                    {submission.preferredGeography ? (
                      <p>
                        <span className="text-foreground font-medium">Preferred geography:</span>{' '}
                        {submission.preferredGeography}
                      </p>
                    ) : null}
                    {submission.referredBy ? (
                      <p>
                        <span className="text-foreground font-medium">Referred by:</span>{' '}
                        {submission.referredBy}
                      </p>
                    ) : null}
                    {submission.associatedChapterOrOrg ? (
                      <p>
                        <span className="text-foreground font-medium">Chapter / org:</span>{' '}
                        {submission.associatedChapterOrOrg}
                      </p>
                    ) : null}
                    <p className="text-xs">
                      Consent — review: {submission.consentToReview ? 'yes' : 'no'} · manual-intro
                      understanding: {submission.consentManualIntroUnderstanding ? 'yes' : 'no'} ·
                      share selected info: {submission.consentToShareSelectedInfo ? 'yes' : 'no'} ·
                      notice version: {submission.consentPolicyVersion}
                    </p>
                  </div>

                  {canReview ? (
                    <form action={updateBusinessConnectNotes} className="mt-4 space-y-3">
                      <input type="hidden" name="id" value={submission.id} />
                      <div>
                        <label className="text-foreground block text-xs font-medium">
                          Organizer notes
                        </label>
                        <textarea
                          name="adminNotes"
                          rows={2}
                          defaultValue={submission.adminNotes ?? ''}
                          className="border-border mt-1 w-full rounded-[var(--radius-button)] border bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-foreground block text-xs font-medium">
                          Match notes
                        </label>
                        <textarea
                          name="matchNotes"
                          rows={2}
                          defaultValue={submission.matchNotes ?? ''}
                          className="border-border mt-1 w-full rounded-[var(--radius-button)] border bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium"
                      >
                        Save notes
                      </button>
                    </form>
                  ) : null}
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
