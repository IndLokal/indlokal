'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { requestAdminMagicLink, type AdminLoginResult } from './actions';
import { LoginAlert } from '@/components/auth/login-alert';
import { LoginShell } from '@/components/auth/login-shell';
import { LoginSuccess } from '@/components/auth/login-success';

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'The access link was incomplete. Please request a new one.',
  invalid_token: 'That access link is invalid or has already been used. Please request a new one.',
  expired_token:
    'That access link has expired (links are valid for 24 hours). Please request a new one.',
};

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState<AdminLoginResult, FormData>(
    requestAdminMagicLink,
    null,
  );
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] : null;
  const signedOut = searchParams.get('signed_out') === '1';

  if (state?.success) {
    return (
      <LoginSuccess
        body="We've sent a secure login link to your email. Click it to continue to internal tools."
        hint="Secure link expires in 24 hours. Check your spam folder if you don't see it."
        backHref="/admin/login"
        backLabel="Back to internal login"
      />
    );
  }

  return (
    <LoginShell
      title="Internal access"
      description="Enter your authorized email to receive a secure one-time sign-in link."
    >
      <form action={formAction} className="mt-8 space-y-5 text-left">
        {signedOut && !urlErrorMessage && (
          <LoginAlert tone="success">
            You&apos;ve been signed out. Request a new link to sign back in.
          </LoginAlert>
        )}
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
            className="border-border text-foreground placeholder:text-muted focus:border-brand-500 focus:ring-brand-500 block w-full rounded-[var(--radius-button)] border bg-white px-3.5 py-2.5 text-sm transition-colors focus:ring-1 focus:outline-none"
            placeholder="you@company.com"
          />
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
