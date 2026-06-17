import type { ReactNode } from 'react';
import { SiteHeader, type HeaderNavLink } from './SiteHeader';
import { Footer } from './Footer';

type AppShellProps = {
  children: ReactNode;
  /** Optional subtitle shown next to the logo (e.g. city name). */
  subtitle?: string;
  /** Desktop nav links. If omitted, only logo + auth shown. */
  navLinks?: HeaderNavLink[];
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
      <SiteHeader
        subtitle={subtitle}
        navLinks={navLinks}
        searchHref={searchHref}
        searchLabel={searchLabel}
      />

      <main className={`mx-auto w-full ${maxWidth} flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8`}>
        {children}
      </main>

      <Footer />
    </div>
  );
}
