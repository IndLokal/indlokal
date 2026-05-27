import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { BrandLink } from '@/components/BrandLink';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // Only EVENT_HOST and PLATFORM_ADMIN may access the host sub-portal
  if (!user) redirect('/organizer/host/start');
  if (user.role !== 'EVENT_HOST' && user.role !== 'PLATFORM_ADMIN') {
    // Community admins go to the main organizer portal
    redirect('/organizer');
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <BrandLink
              href="/"
              markSize={32}
              showName={false}
              className="transition-opacity hover:opacity-80"
            />
            <span className="text-foreground text-base font-bold tracking-tight">Event Host</span>
            <div className="bg-border h-5 w-px" />
            <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
              <Link
                href="/organizer/host"
                className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/organizer/host/events"
                className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
              >
                My Events
              </Link>
              <Link
                href="/organizer/host/events/new"
                className="text-brand-600 hover:bg-brand-50 hover:text-brand-700 ml-2 rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
              >
                + New Event
              </Link>
            </nav>
          </div>
          <div className="border-border flex items-center gap-4 border-l pl-4">
            <span className="text-muted hidden max-w-[200px] truncate text-sm sm:inline">
              {user.displayName ?? user.email}
            </span>
            <form action="/organizer/logout" method="POST">
              <button
                type="submit"
                className="text-muted hover:text-destructive text-sm font-medium transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
