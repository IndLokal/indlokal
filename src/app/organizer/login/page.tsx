'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { requestMagicLink, type LoginResult } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'The access link was incomplete. Please request a new one.',
  invalid_token: 'That access link is invalid or has already been used. Please request a new one.',
  expired_token:
    'That access link has expired (links are valid for 24 hours). Please request a new one.',
};

export default function OrganizerLoginPage() {
  const [state, formAction, isPending] = useActionState<LoginResult, FormData>(
    requestMagicLink,
    null,
  );
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] : null;

  if (state?.success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
            ✓
          </div>
          <h2 className="text-xl font-bold tracking-tight text-emerald-900">Check your inbox</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-emerald-800">
            We&apos;ve sent an access link for{' '}
            <strong className="font-semibold">{state.communityName}</strong> to your email address.
            Click the link to securely open your dashboard.
          </p>
          <p className="mt-6 border-t border-emerald-200/50 pt-4 text-xs font-medium text-emerald-600/70">
            Secure link expires in 24 hours. Check your spam folder if you don&apos;t see it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card-base px-8 py-10 text-center">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Organizer Login</h1>
          <p className="text-muted mt-2 text-sm">
            Enter your email address to receive a secure login link. No passwords required.
          </p>

          <form action={formAction} className="mt-8 space-y-5 text-left">
            {urlErrorMessage && (
              <p className="rounded-[var(--radius-button)] border border-amber-200/50 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {urlErrorMessage}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-foreground block text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            {state?.success === false && (
              <p className="bg-destructive/10 text-destructive rounded-[var(--radius-button)] px-4 py-3 text-sm font-medium">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary mt-2 w-full py-2.5 text-base"
            >
              {isPending ? 'Sending secure link...' : 'Get access link'}
            </button>
          </form>
        </div>

        <p className="text-muted mt-6 text-center text-sm">
          Only approved community organizers can log in.
          <br />
          <Link
            href="/submit"
            className="text-brand-600 hover:text-brand-700 font-semibold transition-colors hover:underline"
          >
            Submit your community
          </Link>{' '}
          to get an invite.
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-muted hover:text-foreground inline-flex items-center text-sm font-medium transition-colors"
          >
            <span className="mr-1.5">←</span> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
