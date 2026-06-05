import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/auth/permissions';
import { canInviteCommunityCollaborators } from '@/lib/auth/community-permissions';
import { ACTIVE_BUSINESS_CONNECT_PILOT } from './pilot';
import { BusinessConnectPageView } from './BusinessConnectPageView';

const pilot = ACTIVE_BUSINESS_CONNECT_PILOT;

export const metadata: Metadata = {
  title: `${pilot.partnerName} Business Connect | IndLokal`,
  description: `An invite-based India-Germany business introduction desk by ${pilot.partnerName} and IndLokal. Enquiries are reviewed manually before any introduction.`,
  robots: { index: false, follow: false },
};

const FOR_WHOM = [
  `Indian and German businesses connected to the ${pilot.partnerName} business event`,
  'Founders, investors, advisors, and service providers seeking trusted collaboration',
  `Members and partners of the ${pilot.partnerName} community`,
];

const HOW_IT_WORKS = [
  {
    title: 'Share your business need',
    body: 'Complete a short structured enquiry with your business context and introduction request.',
  },
  {
    title: 'Joint review by organizers',
    body: `IndLokal and ${pilot.partnerName} review each enquiry for fit, relevance, and readiness.`,
  },
  {
    title: 'Relevant introductions only',
    body: 'If there is a suitable match, the team reaches out. Submission does not guarantee an introduction.',
  },
];

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

export default async function BusinessConnectLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; preview?: string }>;
}) {
  const dashboardHref = await getDashboardHref();
  const { invite, preview } = await searchParams;
  const inviteToken = invite?.trim() || null;
  const previewRequested = preview === '1' || preview === 'true';
  const canPreview = Boolean(dashboardHref);
  // Only staff in preview context should see dashboard navigation. A person
  // opening the form from an invite link must never see internal links.
  const showDashboardLink = previewRequested && canPreview;

  const continueHref = inviteToken
    ? `/jito-stuttgart/business-connect/submit?invite=${encodeURIComponent(inviteToken)}`
    : previewRequested && canPreview
      ? '/jito-stuttgart/business-connect/submit?preview=1'
      : null;

  const continueLabel = inviteToken
    ? 'Continue to enquiry form'
    : previewRequested && canPreview
      ? 'Continue to enquiry form'
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <BusinessConnectPageView />

      <p className="text-brand-700 text-sm font-semibold">{pilot.eventLabel}</p>
      <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">
        {pilot.partnerName} × IndLokal Business Connect
      </h1>
      <p className="text-muted mt-4 text-lg leading-relaxed">
        A curated India-Germany business introduction desk. If you received an invite, use your
        personal link to submit an enquiry. Every enquiry is reviewed manually by IndLokal and{' '}
        {pilot.partnerName} before any introduction is made.
      </p>

      <div className="border-brand-200 bg-brand-50 mt-6 rounded-[var(--radius-card)] border p-4">
        <p className="text-foreground text-sm font-medium">Invitation required</p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          The enquiry form opens only from a personal invite link tied to your email. If you are
          expecting access, check your inbox or ask your {pilot.partnerName} contact for an invite.
        </p>
        {continueHref && continueLabel ? (
          <div className="mt-3">
            <Link
              href={continueHref}
              className="bg-brand-600 hover:bg-brand-700 inline-flex rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              {continueLabel}
            </Link>
          </div>
        ) : null}
      </div>

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

      {/* Trust note */}
      <div className="border-brand-200 bg-brand-50 mt-10 rounded-[var(--radius-card)] border p-5">
        <h2 className="text-foreground text-base font-semibold">How introductions are handled</h2>
        <ul className="text-muted mt-3 space-y-2 text-sm leading-relaxed">
          <li>• Every enquiry is reviewed manually. There is no automated matching.</li>
          <li>• Your enquiry remains private and is never publicly listed.</li>
          <li>• Submitting does not guarantee an introduction.</li>
          <li>
            • Selected information may be shared only with a relevant matched party, and only after
            review.
          </li>
        </ul>
      </div>

      {/* Who it is for */}
      <section className="mt-10">
        <h2 className="text-foreground text-xl font-semibold">Who it is for</h2>
        <ul className="mt-4 space-y-2">
          {FOR_WHOM.map((item) => (
            <li key={item} className="text-muted flex gap-2 text-sm leading-relaxed">
              <span className="text-brand-600">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="text-foreground text-xl font-semibold">How it works</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <div key={step.title} className="border-border rounded-[var(--radius-card)] border p-4">
              <span className="bg-brand-100 text-brand-700 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold">
                {index + 1}
              </span>
              <h3 className="text-foreground mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="text-muted mt-1 text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <p className="text-muted text-sm leading-relaxed">
          This is a curated introduction flow, not a marketplace or public directory.
        </p>
      </section>

      <div className="border-border mt-10 border-t pt-6">
        <p className="text-muted text-sm leading-relaxed">
          The enquiry form opens from your personal invite link. Ask your {pilot.partnerName}{' '}
          contact if you need one.
        </p>
      </div>
    </div>
  );
}
