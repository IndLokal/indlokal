import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { MobileNav } from '@/components/MobileNav';
import { BrandLink } from '@/components/BrandLink';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // Resolve active community for workspace switcher display
  const currentCommunityId = user ? await getCurrentCommunityId() : null;
  const activeCommunity = user
    ? (user.claimedCommunities.find((c: { id: string }) => c.id === currentCommunityId) ??
      user.claimedCommunities[0] ??
      null)
    : null;
  const isMultiOrg = (user?.claimedCommunities.length ?? 0) > 1;

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

            {/* Workspace switcher - shows active community name + chevron for multi-org */}
            {activeCommunity ? (
              isMultiOrg ? (
                <Link
                  href="/organizer/communities"
                  className="text-foreground hover:text-brand-600 flex items-center gap-1.5 text-base font-bold tracking-tight transition-colors"
                >
                  {activeCommunity.name}
                  <span className="text-muted text-sm">⌄</span>
                </Link>
              ) : (
                <span className="text-foreground text-base font-bold tracking-tight">
                  {activeCommunity.name}
                </span>
              )
            ) : (
              <Link
                href="/organizer"
                className="text-foreground hover:text-brand-600 text-base font-bold tracking-tight transition-colors"
              >
                Organizer Home
              </Link>
            )}

            {user && (
              <div className="ml-4 hidden items-center gap-2 sm:flex">
                <div className="bg-border mr-2 h-5 w-px" />
                <nav className="flex items-center gap-1 text-sm font-medium">
                  <Link
                    href="/organizer"
                    className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                  >
                    Overview
                  </Link>
                  {isMultiOrg && (
                    <Link
                      href="/organizer/communities"
                      className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                    >
                      Communities
                    </Link>
                  )}
                  <Link
                    href="/organizer/edit"
                    className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                  >
                    Community Profile
                  </Link>
                  <Link
                    href="/organizer/channels"
                    className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                  >
                    Community Links
                  </Link>
                  <Link
                    href="/organizer#collaborators"
                    className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                  >
                    Collaborators
                  </Link>
                  <Link
                    href="/organizer/events/new"
                    className="text-brand-600 hover:bg-brand-50 hover:text-brand-700 ml-2 rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                  >
                    + New Event
                  </Link>
                </nav>
              </div>
            )}
            {user && (
              <div className="ml-2 sm:hidden">
                <MobileNav
                  links={[
                    { href: '/organizer', label: 'Overview' },
                    ...(isMultiOrg
                      ? [{ href: '/organizer/communities', label: 'Communities' }]
                      : []),
                    { href: '/organizer/edit', label: 'Community Profile' },
                    { href: '/organizer/channels', label: 'Community Links' },
                    { href: '/organizer#collaborators', label: 'Collaborators' },
                    { href: '/organizer/events/new', label: '+ New Event', highlight: true },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="border-border flex items-center gap-4 border-l pl-4">
                <span className="text-muted bg-muted-bg border-border/50 hidden max-w-[200px] truncate rounded-[var(--radius-badge)] border px-2.5 py-1 text-sm font-medium sm:inline-block">
                  {user.email}
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
            ) : (
              <Link href="/organizer/login" className="btn-primary px-4 py-2 text-sm">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
