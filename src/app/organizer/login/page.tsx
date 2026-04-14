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
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="text-4xl">✓</div>
          <h2 className="mt-3 text-xl font-semibold text-green-800">Check your inbox</h2>
          <p className="mt-2 text-sm text-green-700">
            We&apos;ve sent an access link for <strong>{state.communityName}</strong> to your email
            address. Click the link to open your organizer dashboard.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Organizer Login</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter your email address to access your community dashboard.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            {urlErrorMessage && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {urlErrorMessage}
              </p>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="you@example.com"
              />
            </div>

            {state?.success === false && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Checking...' : 'Get access link'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Only approved community organizers can log in.{' '}
          <Link href="/submit" className="underline">
            Submit your community
          </Link>{' '}
          to get started.
        </p>
      </div>
    </div>
  );
}
