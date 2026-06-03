import type { ReactNode } from 'react';
import Link from 'next/link';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { MobileNav } from '@/components/MobileNav';
import { BrandLink } from '@/components/BrandLink';
import { Footer } from './Footer';

type NavLink = {
  href: string;
  label: string;
  highlight?: boolean;
};

type AppShellProps = {
  children: ReactNode;
  /** Optional subtitle shown next to the logo (e.g. city name). */
  subtitle?: string;
  /** Desktop nav links. If omitted, only logo + auth shown. */
  navLinks?: NavLink[];
  /** Max-width of the main content area. Defaults to "max-w-7xl". */
  maxWidth?: string;
  /** If set, renders a single persistent search affordance pointing here. */
  searchHref?: string;
  /** Placeholder/label for the search affordance (e.g. "Search Stuttgart"). */
  searchLabel?: string;
};

/**
 * Shared layout shell for public-facing routes.
 *
 * Provides: sticky header, responsive nav (desktop + MobileNav), main content area, footer.
 * Uses the new Design System (Brand Colors, Typography).
 */
export function AppShell({
  children,
  subtitle,
  navLinks,
  maxWidth = 'max-w-7xl',
  searchHref,
  searchLabel = 'Search',
}: AppShellProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md sm:backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <BrandLink hideNameOnMobile />

            {subtitle && (
              <div className="text-brand-700 bg-brand-50 ring-brand-100 flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1">
                <span className="mr-1.5 text-base">📍</span>
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Single, persistent search affordance — looks like a search box,
                routes to the dedicated search page so every sub-page shares the
                same entry point (no per-page duplication). */}
            {searchHref && (
              <Link
                href={searchHref}
                className="text-muted hover:text-foreground border-border hover:border-brand-200 hover:bg-muted-bg/60 hidden items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors lg:flex"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span>{searchLabel}</span>
              </Link>
            )}

            {/* Desktop nav */}
            {navLinks && navLinks.length > 0 && (
              <nav className="mr-4 hidden items-center gap-1 sm:flex">
                {navLinks.map((link) =>
                  link.highlight ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="btn-primary ml-2 px-3.5 py-1.5 text-sm"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-muted hover:bg-muted-bg hover:text-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </nav>
            )}

            <div className="border-border hidden h-6 shrink-0 items-center border-l pl-4 sm:flex">
              <NavAuthWidget />
            </div>

            {/* Mobile nav / hamburger */}
            <div className="flex items-center gap-3 sm:hidden">
              {searchHref && (
                <Link
                  href={searchHref}
                  aria-label={searchLabel}
                  className="text-muted hover:text-foreground hover:bg-muted-bg flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </Link>
              )}
              <NavAuthWidget />
              {navLinks && navLinks.length > 0 && <MobileNav links={navLinks} />}
            </div>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full ${maxWidth} flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8`}>
        {children}
      </main>

      <Footer />
    </div>
  );
}
