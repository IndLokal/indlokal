import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { MobileNav } from '@/components/MobileNav';
import { BrandLink } from '@/components/BrandLink';
import { OrganizerNav } from '@/components/organizer/nav';
import { buildOrganizerWorkspace, type OrganizerSessionCommunity } from '@/lib/organizer/workspace';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  const currentCommunityId = user ? await getCurrentCommunityId() : null;
  const workspace = user
    ? buildOrganizerWorkspace<OrganizerSessionCommunity>(user, currentCommunityId)
    : null;
  const activeCommunity = workspace?.community ?? null;
  const activeRole = workspace?.role ?? null;
  const isMultiOrg = workspace?.isMultiCommunity ?? false;
  const accountLabel = user?.displayName ?? user?.email ?? 'Account';
  const accountInitial = accountLabel.charAt(0).toUpperCase();

  const navLinks = [
    { href: '/organizer', label: 'Overview' },
    { href: '/organizer/profile', label: 'Community Page' },
    { href: '/organizer/links', label: 'Links' },
    { href: '/organizer/collaborators', label: 'Team' },
    { href: '/organizer/events', label: 'Events' },
  ];

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLink
              href="/"
              markSize={32}
              showName={false}
              className="flex shrink-0 items-center transition-opacity hover:opacity-80"
            />

            {/* Workspace switcher - shows active community name + chevron for multi-org */}
            {activeCommunity ? (
              <Link
                href={isMultiOrg ? '/organizer/communities' : '/organizer'}
                className="border-border hover:bg-muted-bg flex h-10 min-w-0 max-w-[220px] items-center gap-2 rounded-[var(--radius-button)] border bg-white px-2.5 text-left transition-colors sm:max-w-[340px]"
                aria-label={
                  isMultiOrg ? 'Switch community workspace' : 'Current community workspace'
                }
              >
                <span className="bg-brand-100 text-brand-700 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {activeCommunity.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-[13px] font-semibold leading-4">
                    {activeCommunity.name}
                  </span>
                  <span className="text-muted block truncate text-[11px] leading-3">
                    {activeCommunity.city.name}
                    {activeRole ? ` · ${activeRole === 'OWNER' ? 'Owner' : 'Collaborator'}` : ''}
                  </span>
                </span>
                {isMultiOrg && <span className="text-muted ml-auto shrink-0 text-xs">⌄</span>}
              </Link>
            ) : (
              <Link
                href="/organizer"
                className="text-foreground hover:text-brand-600 text-sm font-semibold transition-colors"
              >
                Organizer Home
              </Link>
            )}
            {user && (
              <div className="ml-1 sm:hidden">
                <MobileNav
                  links={[
                    ...navLinks,
                    { href: '/organizer/events/new', label: '+ New Event', highlight: true },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <details className="group relative hidden sm:block">
                <summary className="border-border hover:bg-muted-bg flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border bg-white px-2 text-sm transition-colors marker:hidden">
                  <span className="bg-foreground text-background flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold leading-none">
                    {accountInitial}
                  </span>
                  <span className="text-muted hidden text-xs font-semibold lg:inline">Account</span>
                  <span className="text-muted text-xs">⌄</span>
                </summary>
                <div className="border-border absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] border bg-white p-3 shadow-lg">
                  <p className="text-foreground truncate text-sm font-semibold">{accountLabel}</p>
                  <p className="text-muted mt-0.5 truncate text-xs">{user.email}</p>
                  <div className="border-border mt-3 border-t pt-3">
                    <form action="/organizer/logout" method="POST">
                      <button
                        type="submit"
                        className="hover:bg-muted-bg text-muted hover:text-destructive w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm font-medium transition-colors"
                      >
                        Log out
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ) : (
              <Link href="/organizer/login" className="btn-primary px-4 py-2 text-sm">
                Login
              </Link>
            )}
          </div>
        </div>
        {user && (
          <div className="border-border bg-muted-bg/35 hidden border-t sm:block">
            <OrganizerNav links={navLinks} />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
