import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { ACTIVE_BUSINESS_CONNECT_PILOT, getBusinessConnectPilot } from '../pilot';
import { isInviteUsable } from '../invite';
import { SubmitBusinessConnectForm } from './SubmitBusinessConnectForm';

const pilot = ACTIVE_BUSINESS_CONNECT_PILOT;

// Invite-only and private: never index the enquiry form.
export const metadata: Metadata = {
  title: `Submit a Business Enquiry | ${pilot.partnerName} Business Connect Pilot | IndLokal`,
  description: `Submit a structured business enquiry for the ${pilot.partnerName} × IndLokal Business Connect pilot. Invite-only; reviewed manually.`,
  robots: { index: false, follow: false },
};

function Breadcrumb() {
  return (
    <nav className="text-muted mb-6 text-sm font-medium">
      <Link
        href="/jito-stuttgart/business-connect"
        className="hover:text-foreground transition-colors"
      >
        Business Connect pilot
      </Link>
      <span className="text-border mx-2">/</span>
      <span className="text-foreground">Submit enquiry</span>
    </nav>
  );
}

function InviteOnlyNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Breadcrumb />
      <p className="text-brand-700 text-sm font-semibold">{pilot.eventLabel}</p>
      <h1 className="text-foreground mt-1 text-3xl font-bold tracking-tight">
        Business Connect is invite-only
      </h1>
      <p className="text-muted mt-3 leading-relaxed">
        This enquiry form opens only from a personal invite link. {pilot.partnerName} invites guests
        directly, and each link is tied to the email it was sent to. If you were expecting access,
        check your inbox for your invite email, or ask your {pilot.partnerName} contact to invite
        you.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={pilot.cityPath}
          className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          Explore {pilot.cityLabel}
        </Link>
        <Link
          href="/"
          className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-4 py-2 text-sm font-semibold transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default async function BusinessConnectSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: inviteToken } = await searchParams;

  if (!inviteToken) {
    return <InviteOnlyNotice />;
  }

  const tokenHash = await hashToken(inviteToken);
  const invite = await db.businessConnectInvite.findUnique({
    where: { tokenHash },
    select: { email: true, pilotSlug: true, usedAt: true, expiresAt: true },
  });

  if (!invite || !isInviteUsable(invite)) {
    return <InviteOnlyNotice />;
  }

  const invitePilot = getBusinessConnectPilot(invite.pilotSlug) ?? pilot;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Breadcrumb />

      <p className="text-brand-700 text-sm font-semibold">{invitePilot.eventLabel}</p>
      <h1 className="text-foreground mt-1 text-3xl font-bold tracking-tight">
        Submit a business enquiry
      </h1>
      <p className="text-muted mt-3 leading-relaxed">
        Tell us about your business and what kind of collaboration you are looking for. Submissions
        are reviewed manually by IndLokal and {invitePilot.partnerName}. Submitting does not
        guarantee an introduction, and your enquiry will not be publicly listed.
      </p>

      <div className="border-border mt-8 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        <SubmitBusinessConnectForm
          pilot={invitePilot}
          inviteToken={inviteToken}
          inviteEmail={invite.email}
        />
      </div>
    </div>
  );
}
