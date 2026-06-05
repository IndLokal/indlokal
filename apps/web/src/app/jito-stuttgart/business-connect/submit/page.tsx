import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/auth/permissions';
import { canInviteCommunityCollaborators } from '@/lib/auth/community-permissions';
import { ACTIVE_BUSINESS_CONNECT_PROGRAM, getBusinessConnectProgram } from '../pilot';
import { isInviteUsable } from '../invite';
import { resendBusinessConnectConfirmation } from './actions';
import { SubmitBusinessConnectForm } from './SubmitBusinessConnectForm';

const pilot = ACTIVE_BUSINESS_CONNECT_PROGRAM;

// Invite-only and private: never index the enquiry form.
export const metadata: Metadata = {
  title: `Submit a Business Enquiry | ${pilot.partnerName} Business Connect | IndLokal`,
  description: `Submit a structured business enquiry for the ${pilot.partnerName} × IndLokal Business Connect program. Invite-only; reviewed manually.`,
  robots: { index: false, follow: false },
};

function Breadcrumb({ href = '/jito-stuttgart/business-connect' }: { href?: string }) {
  return (
    <nav className="text-muted mb-6 text-sm font-medium">
      <Link href={href} className="hover:text-foreground transition-colors">
        Business Connect
      </Link>
      <span className="text-border mx-2">/</span>
      <span className="text-foreground">Submit enquiry</span>
    </nav>
  );
}

function NoticeActions({ dashboardHref }: { dashboardHref: string | null }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/"
        className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        Explore IndLokal
      </Link>
      {dashboardHref ? (
        <Link
          href={dashboardHref}
          className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-4 py-2 text-sm font-semibold transition-colors"
        >
          Back to dashboard
        </Link>
      ) : null}
    </div>
  );
}

function NoticeShell({
  title,
  body,
  dashboardHref,
  breadcrumbHref,
  secondaryBody,
  children,
}: {
  title: string;
  body: string;
  dashboardHref: string | null;
  breadcrumbHref?: string;
  secondaryBody?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumb href={breadcrumbHref} />
      <p className="text-brand-700 text-sm font-semibold">{pilot.eventLabel}</p>
      <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted mt-3 leading-relaxed">{body}</p>
      {secondaryBody ? (
        <p className="text-muted mt-2 text-sm leading-relaxed">{secondaryBody}</p>
      ) : null}
      {children}
      <NoticeActions dashboardHref={dashboardHref} />
    </div>
  );
}

function InviteOnlyNotice({ dashboardHref }: { dashboardHref: string | null }) {
  return (
    <NoticeShell
      title="Business Connect is invite-only"
      body={`This enquiry form opens only from a personal invite link. ${pilot.partnerName} invites guests directly, and each link is tied to the email it was sent to. If you were expecting access, check your inbox for your invite email, or ask your ${pilot.partnerName} contact to invite you.`}
      dashboardHref={dashboardHref}
    />
  );
}

function AlreadySubmittedNotice({ dashboardHref }: { dashboardHref: string | null }) {
  return (
    <NoticeShell
      title="This enquiry link has already been used"
      body="This invite link has already been used to submit an enquiry. Please use the confirmation link from your email to complete confirmation."
      secondaryBody="If you cannot find that email, check spam/junk. If needed, ask your organizer for a fresh invite."
      dashboardHref={dashboardHref}
    />
  );
}

function PendingConfirmationNotice({
  dashboardHref,
  inviteToken,
  resent,
}: {
  dashboardHref: string | null;
  inviteToken: string;
  resent?: string;
}) {
  const statusText =
    resent === 'ok'
      ? 'A new confirmation email has been sent. Please check your inbox and spam folder.'
      : resent === 'expired'
        ? 'Your previous confirmation link has expired. Ask your organizer for a fresh invite.'
        : resent === 'already'
          ? 'This enquiry is already confirmed.'
          : resent === 'invalid'
            ? 'Could not resend the confirmation email. Please ask your organizer for help.'
            : null;

  return (
    <NoticeShell
      title="Your enquiry is waiting for email confirmation"
      body="You've already submitted this enquiry. Please confirm it from the email link to move it into review."
      dashboardHref={dashboardHref}
      breadcrumbHref={`/jito-stuttgart/business-connect?invite=${encodeURIComponent(inviteToken)}`}
    >
      {statusText ? (
        <p className="border-border bg-muted-bg text-foreground mt-4 rounded-[var(--radius-button)] border px-4 py-3 text-sm">
          {statusText}
        </p>
      ) : null}

      <div className="mt-6">
        <form action={resendBusinessConnectConfirmation}>
          <input type="hidden" name="inviteToken" value={inviteToken} />
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Resend confirmation email
          </button>
        </form>
      </div>
    </NoticeShell>
  );
}

async function getDashboardHref(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  if (can(user, 'business_connect.read')) return '/admin/business-connect';

  const community = await db.community.findUnique({
    where: { slug: pilot.communitySlug },
    select: { id: true },
  });
  if (!community) return null;

  return canInviteCommunityCollaborators(user, community.id) ? '/organizer/business-connect' : null;
}

export default async function BusinessConnectSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; preview?: string; resent?: string }>;
}) {
  const { invite: inviteToken, preview, resent } = await searchParams;
  const dashboardHref = await getDashboardHref();

  const previewRequested = preview === '1' || preview === 'true';
  const isPreview = previewRequested && Boolean(dashboardHref);
  const showDashboardLink = isPreview;

  let selectedPilot = pilot;
  let formInviteToken = inviteToken;
  let formInviteEmail: string | null = null;
  let breadcrumbHref = '/jito-stuttgart/business-connect';

  if (isPreview) {
    formInviteToken = 'preview-only';
    formInviteEmail = 'preview@indlokal.com';
    breadcrumbHref = '/jito-stuttgart/business-connect?preview=1';
  }

  if (!isPreview && !inviteToken) {
    return <InviteOnlyNotice dashboardHref={dashboardHref} />;
  }

  if (!isPreview) {
    const tokenHash = await hashToken(inviteToken as string);
    const invite = await db.businessConnectInvite.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        pilotSlug: true,
        usedAt: true,
        expiresAt: true,
        submission: {
          select: { status: true, emailConfirmedAt: true },
        },
      },
    });

    if (!invite) {
      return <InviteOnlyNotice dashboardHref={dashboardHref} />;
    }

    if (
      invite.submission &&
      invite.submission.status === 'PENDING_CONFIRMATION' &&
      !invite.submission.emailConfirmedAt
    ) {
      return (
        <PendingConfirmationNotice
          dashboardHref={dashboardHref}
          inviteToken={inviteToken as string}
          resent={resent}
        />
      );
    }

    if (invite.usedAt || invite.submission) {
      return <AlreadySubmittedNotice dashboardHref={dashboardHref} />;
    }

    if (!isInviteUsable(invite)) {
      return <InviteOnlyNotice dashboardHref={dashboardHref} />;
    }

    selectedPilot = getBusinessConnectProgram(invite.pilotSlug) ?? pilot;
    formInviteEmail = invite.email;
    breadcrumbHref = `/jito-stuttgart/business-connect?invite=${encodeURIComponent(inviteToken as string)}`;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Breadcrumb href={breadcrumbHref} />

      <p className="text-brand-700 text-sm font-semibold">{selectedPilot.eventLabel}</p>
      <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">
        Submit a business enquiry{isPreview ? ' (preview)' : ''}
      </h1>
      <p className="text-muted mt-4 text-lg leading-relaxed">
        Tell us about your business and what kind of collaboration you are looking for. Submissions
        are reviewed manually by IndLokal and {selectedPilot.partnerName}. Submitting does not
        guarantee an introduction, and your enquiry will not be publicly listed.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-5 py-3 text-sm font-semibold text-white transition-colors"
        >
          Explore IndLokal
        </Link>
        {showDashboardLink && dashboardHref ? (
          <Link
            href={dashboardHref}
            className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-5 py-3 text-sm font-semibold transition-colors"
          >
            Back to dashboard
          </Link>
        ) : null}
      </div>

      {isPreview ? (
        <div className="mt-6 rounded-[var(--radius-button)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This is a staff preview of the invite-only form. Submission is disabled.
        </div>
      ) : null}

      <div className="border-border mt-8 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        <SubmitBusinessConnectForm
          pilot={selectedPilot}
          inviteToken={formInviteToken as string}
          inviteEmail={formInviteEmail as string}
          previewMode={isPreview}
          dashboardHref={showDashboardLink ? dashboardHref : null}
        />
      </div>
    </div>
  );
}
