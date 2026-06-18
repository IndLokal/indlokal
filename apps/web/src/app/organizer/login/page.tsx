'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { requestMagicLink, type LoginResult } from './actions';
import { LoginAlert } from '@/components/auth/login-alert';
import { LoginShell } from '@/components/auth/login-shell';
import { LoginSuccess } from '@/components/auth/login-success';

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
  const prefilledEmail = searchParams.get('email') ?? '';
  const urlError = searchParams.get('error');
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] : null;

  if (state?.success) {
    return (
      <LoginSuccess
        body={
          <>
            We&apos;ve sent an access link for{' '}
            <strong className="font-semibold">{state.communityName}</strong> to your email address.
            Click the link to securely open your organizer home.
          </>
        }
        hint="Secure link expires in 24 hours. Check your spam folder if you don't see it."
        backHref="/organizer/login"
        backLabel="Back to organizer login"
      />
    );
  }

  return (
    <LoginShell
      title="Organizer access"
      description="Enter your email address to receive a secure login link. This is for approved organizers - the person or team that already runs a community listing."
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href="/"
            className="text-brand-600 hover:text-brand-700 font-semibold transition-colors hover:underline"
          >
            ← Back to site
          </Link>
          <Link
            href="/submit"
            className="text-muted hover:text-foreground font-medium transition-colors hover:underline"
          >
            Need a new listing?
          </Link>
        </div>
      }
    >
      <form action={formAction} className="mt-8 space-y-5 text-left">
        {urlErrorMessage && <LoginAlert tone="warning">{urlErrorMessage}</LoginAlert>}

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
            defaultValue={prefilledEmail}
            className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
            placeholder="you@example.com"
          />
          {prefilledEmail ? (
            <p className="text-muted text-xs">Using the email from your approval link.</p>
          ) : null}
        </div>

        {state?.success === false && <LoginAlert tone="error">{state.error}</LoginAlert>}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary mt-2 w-full py-2.5 text-base"
        >
          {isPending ? 'Sending secure link...' : 'Get access link'}
        </button>
      </form>
    </LoginShell>
  );
}
