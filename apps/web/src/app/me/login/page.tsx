import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Sign in — IndLokal',
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect('/me');

  const { error } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-foreground text-2xl font-bold">Sign in to IndLokal</h1>
          <p className="text-muted mt-2 text-sm">
            Save communities and events you&apos;re interested in.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-[var(--radius-button)] px-4 py-3 text-sm font-medium">
            Sign-in failed. Please try again.
          </div>
        )}

        {/*
         * The browser-side sign-in UI is being rebuilt against the
         * `/api/v1/auth/*` JWT endpoints (TDD-0001 §3). The legacy
         * cookie-based Google redirect was removed in the same PR
         * that introduced `/api/v1/auth/google` per TDD-0001 §10.
         * The mobile app consumes the v1 endpoints directly; the web
         * SPA flow lands in a follow-up PR.
         */}
        <div className="card-base text-muted px-4 py-6 text-center text-sm">
          Web sign-in is moving to the new <code>/api/v1/auth/*</code> flow.
          <br />
          Until then please use the mobile app or organizer login.
        </div>

        <p className="text-muted text-center text-xs">
          By signing in, you agree to IndLokal&apos;s terms. We only store your name and email.
        </p>

        <Link
          href="/"
          className="text-muted hover:text-foreground block text-center text-sm transition-colors"
        >
          ← Continue browsing
        </Link>
      </div>
    </div>
  );
}
