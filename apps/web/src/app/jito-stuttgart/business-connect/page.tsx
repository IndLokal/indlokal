import type { Metadata } from 'next';
import Link from 'next/link';
import { ACTIVE_BUSINESS_CONNECT_PILOT } from './pilot';
import { BusinessConnectPageView } from './BusinessConnectPageView';

const pilot = ACTIVE_BUSINESS_CONNECT_PILOT;

export const metadata: Metadata = {
  title: `${pilot.partnerName} Business Connect Pilot | IndLokal`,
  description: `A trust-first, invite-only pilot by ${pilot.partnerName} and IndLokal. Invited guests submit a structured business enquiry; every submission is reviewed manually before any curated India–Germany introduction.`,
  robots: { index: false, follow: false },
};

const FOR_WHOM = [
  `Indian and German businesses connected to the ${pilot.partnerName} business event`,
  'Founders, investors, advisors, and service providers seeking trusted collaboration',
  `Members and partners of the ${pilot.partnerName} community`,
];

const HOW_IT_WORKS = [
  {
    title: 'Submit a structured enquiry',
    body: 'Tell us about your business, what you are looking for, and what you can offer.',
  },
  {
    title: 'We review manually',
    body: `IndLokal and ${pilot.partnerName} review submissions after the event. Trust and relevance matter more than volume.`,
  },
  {
    title: 'Curated introductions only',
    body: 'If there is a relevant potential match, the team may contact you for a curated introduction. Submitting does not guarantee one.',
  },
];

export default function BusinessConnectLandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <BusinessConnectPageView />

      <p className="text-brand-700 text-sm font-semibold">{pilot.eventLabel}</p>
      <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">
        {pilot.partnerName} × IndLokal Business Connect
      </h1>
      <p className="text-muted mt-4 text-lg leading-relaxed">
        A trust-first, invite-only pilot for India–Germany business collaboration.{' '}
        {pilot.partnerName} invites guests directly; if you have an invite, open the personal link
        in your email to submit your enquiry. Every submission is reviewed manually by IndLokal and{' '}
        {pilot.partnerName} before any introduction is made.
      </p>

      <div className="border-brand-200 bg-brand-50 mt-6 rounded-[var(--radius-card)] border p-4">
        <p className="text-foreground text-sm font-medium">This pilot is invite-only.</p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          The enquiry form opens only from a personal invite link tied to your email. If you
          expected access, check your inbox or ask your {pilot.partnerName} contact to invite you.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={pilot.cityPath}
          className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-5 py-3 text-sm font-semibold transition-colors"
        >
          Explore {pilot.cityLabel}
        </Link>
      </div>

      {/* Trust note */}
      <div className="border-brand-200 bg-brand-50 mt-10 rounded-[var(--radius-card)] border p-5">
        <h2 className="text-foreground text-base font-semibold">Why this is trust-first</h2>
        <ul className="text-muted mt-3 space-y-2 text-sm leading-relaxed">
          <li>• Submissions are reviewed manually — there is no automated matching.</li>
          <li>• Your enquiry is private and will never be publicly listed.</li>
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
          This pilot helps validate future India–Germany business connection features for IndLokal.
          It is intentionally curated and private — not a marketplace, not a public directory, and
          not an automated matching system.
        </p>
      </section>

      <div className="border-border mt-10 border-t pt-6">
        <p className="text-muted text-sm leading-relaxed">
          Invite-only — the enquiry form opens from your personal invite link. Ask your{' '}
          {pilot.partnerName} contact if you need an invite.
        </p>
      </div>
    </div>
  );
}
