import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLink } from '@/components/BrandLink';
import { MobileNav } from '@/components/MobileNav';
import { OrganizerNav } from '@/components/organizer/nav';

export type PortalNavLink = { href: string; label: string };

type PortalShellProps = {
  /** Where the brand mark links to (portal home). */
  brandHref: string;
  /**
   * Left-cluster identity slot rendered next to the brand mark — e.g. the
   * community workspace switcher or the host identity box. Falls back to a
   * plain home link when omitted.
   */
  titleSlot?: ReactNode;
  /** Secondary nav-row links (desktop) + mobile menu. */
  navLinks: PortalNavLink[];
  /** Primary call-to-action shown at the end of the nav row (e.g. "+ New Event"). */
  cta?: { href: string; label: string };
  /** Optional "Public view" link in the top-right. */
  publicViewHref?: string;
  /** Account dropdown labels. When absent, a Login button is shown. */
  account?: { label: string; email: string };
  /** Login href used when no account is present. */
  loginHref?: string;
  children: ReactNode;
};

/**
 * Shared chrome for the organizer-family portals (community organizer + event
 * host). Both portals reuse this single shell so they share identical UI/UX:
 * brand mark, identity slot, account dropdown, public-view link, and the
 * highlighted nav row. See docs/HOST_DASHBOARD.md §10.
 */
export function PortalShell({
  brandHref,
  titleSlot,
  navLinks,
  cta,
  publicViewHref,
  account,
  loginHref = '/organizer/login',
  children,
}: PortalShellProps) {
  const accountInitial = (account?.label ?? 'A').charAt(0).toUpperCase();
  const mobileLinks: { href: string; label: string; highlight?: boolean }[] = [
    ...navLinks,
    ...(publicViewHref ? [{ href: publicViewHref, label: 'Public View' }] : []),
    ...(cta ? [{ href: cta.href, label: cta.label, highlight: true }] : []),
  ];

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLink
              href={brandHref}
              markSize={32}
              showName={false}
              className="flex shrink-0 items-center transition-opacity hover:opacity-80"
            />

            {titleSlot ?? (
              <Link
                href={brandHref}
                className="text-foreground hover:text-brand-600 text-sm font-semibold transition-colors"
              >
                Home
              </Link>
            )}

            {account && (
              <div className="ml-1 sm:hidden">
                <MobileNav links={mobileLinks} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {account && publicViewHref && (
              <Link
                href={publicViewHref}
                className="text-muted hover:text-foreground hidden text-sm font-medium transition-colors sm:inline"
              >
                Public view
              </Link>
            )}
            {account ? (
              <details className="group relative hidden sm:block">
                <summary className="border-border hover:bg-muted-bg flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border bg-white px-2 text-sm transition-colors marker:hidden">
                  <span className="bg-foreground text-background flex h-7 w-7 items-center justify-center rounded-full text-xs leading-none font-semibold">
                    {accountInitial}
                  </span>
                  <span className="text-muted hidden text-xs font-semibold lg:inline">Account</span>
                  <span className="text-muted text-xs">⌄</span>
                </summary>
                <div className="border-border absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] border bg-white p-3 shadow-lg">
                  <p className="text-foreground truncate text-sm font-semibold">{account.label}</p>
                  <p className="text-muted mt-0.5 truncate text-xs">{account.email}</p>
                  <div className="border-border mt-3 border-t pt-3">
                    <Link
                      href="/me"
                      className="hover:bg-muted-bg text-muted hover:text-foreground block w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm font-medium transition-colors"
                    >
                      Personal Account
                    </Link>
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
              <Link href={loginHref} className="btn-primary px-4 py-2 text-sm">
                Login
              </Link>
            )}
          </div>
        </div>
        {account && (
          <div className="border-border bg-muted-bg/35 hidden border-t sm:block">
            <OrganizerNav links={navLinks} cta={cta} />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
