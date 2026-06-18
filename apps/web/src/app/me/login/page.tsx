import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Sign in - IndLokal',
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
          <h1 className="text-foreground text-2xl font-bold">Sign in</h1>
          <p className="text-muted mt-2 text-sm">
            Save communities, follow events, and pick up where you left off on any device.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-[var(--radius-button)] px-4 py-3 text-sm font-medium">
            Sign-in failed. Please try again.
          </div>
        )}

        <div className="space-y-4">
          {/* Full-page navigation to a Route Handler that starts the OAuth
              redirect — must NOT be a prefetched <Link> client navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/auth/google/start"
            className="border-border text-foreground hover:bg-muted/5 flex w-full items-center justify-center gap-3 rounded-[var(--radius-button)] border bg-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
              />
            </svg>
            Continue with Google
          </a>
        </div>

        <p className="text-muted text-center text-xs">
          By signing in, you agree to IndLokal&apos;s terms. We only store your name and email.
        </p>

        <div className="border-border/60 space-y-3 border-t pt-6 text-center">
          <p className="text-muted text-sm">
            Run a community listing?{' '}
            <Link href="/organizer/login" className="text-brand-600 font-semibold hover:underline">
              Organizer access
            </Link>
          </p>
          <Link
            href="/"
            className="text-muted hover:text-foreground block text-sm transition-colors"
          >
            ← Continue browsing
          </Link>
        </div>
      </div>
    </div>
  );
}
