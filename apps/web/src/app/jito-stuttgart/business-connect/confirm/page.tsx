import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { ACTIVE_BUSINESS_CONNECT_PROGRAM } from '../pilot';
import { isConfirmationFresh } from '../submit/confirmation';
import { confirmBusinessConnectEnquiry } from './actions';

const pilot = ACTIVE_BUSINESS_CONNECT_PROGRAM;

export const metadata: Metadata = {
  title: `Confirm your enquiry | ${pilot.partnerName} Business Connect Pilot | IndLokal`,
  robots: { index: false, follow: false },
};

type Outcome = 'done' | 'invalid' | 'confirm' | 'already';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-brand-700 text-sm font-semibold">{pilot.eventLabel}</p>
      <div className="border-border mt-4 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}

export default async function BusinessConnectConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;

  let outcome: Outcome;
  let companyName: string | null = null;

  if (state === 'done') {
    outcome = 'done';
  } else if (state === 'invalid') {
    outcome = 'invalid';
  } else if (token) {
    const tokenHash = await hashToken(token.trim());
    const submission = await db.businessConnectSubmission.findUnique({
      where: { emailConfirmationTokenHash: tokenHash },
      select: { companyName: true, createdAt: true, emailConfirmedAt: true },
    });
    if (!submission || !isConfirmationFresh(submission.createdAt)) {
      outcome = 'invalid';
    } else if (submission.emailConfirmedAt) {
      outcome = 'already';
    } else {
      outcome = 'confirm';
      companyName = submission.companyName;
    }
  } else {
    outcome = 'invalid';
  }

  if (outcome === 'confirm') {
    return (
      <Shell>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Confirm your enquiry</h1>
        <p className="text-muted mt-4 leading-relaxed">
          Confirm the enquiry
          {companyName ? (
            <>
              {' '}
              for <strong>{companyName}</strong>
            </>
          ) : null}{' '}
          to send it to the {pilot.partnerName} review team. Nothing is shared until you confirm.
        </p>
        <form action={confirmBusinessConnectEnquiry} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-5 py-3 text-sm font-semibold text-white transition-colors"
          >
            Confirm my enquiry
          </button>
        </form>
      </Shell>
    );
  }

  if (outcome === 'invalid') {
    return (
      <Shell>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          This confirmation link is invalid or has expired
        </h1>
        <p className="text-muted mt-4 leading-relaxed">
          The link may have already been used, or it may have expired. If you have already submitted
          your enquiry, no further action is needed. If you still need to submit, ask your{' '}
          {pilot.partnerName} contact for a fresh invite link.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Explore IndLokal
          </Link>
        </div>
      </Shell>
    );
  }

  // 'done' or 'already'
  return (
    <Shell>
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        {outcome === 'already' ? 'Your enquiry is already confirmed' : 'Your enquiry is confirmed'}
      </h1>
      <p className="text-muted mt-4 leading-relaxed">
        Thank you. Your enquiry is now with the IndLokal and {pilot.partnerName} review team. If
        there is a relevant potential match, the team may contact you for a curated introduction.
      </p>
      <p className="text-muted mt-3 text-sm">
        Submitting an enquiry does not guarantee an introduction, and your enquiry will never be
        publicly listed.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          Explore IndLokal
        </Link>
      </div>
    </Shell>
  );
}
