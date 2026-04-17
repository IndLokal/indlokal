import type { ReactNode } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { MobileNav } from '@/components/MobileNav';
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
};

/**
 * Shared layout shell for public-facing routes.
 *
 * Provides: sticky header, responsive nav (desktop + MobileNav), main content area, footer.
 * Uses the new Design System (Brand Colors, Typography).
 */
export function AppShell({ children, subtitle, navLinks, maxWidth = 'max-w-7xl' }: AppShellProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <span className="from-brand-500 to-brand-700 shadow-brand-500/20 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md">
                L
              </span>
              <span className="text-foreground hidden text-xl font-bold tracking-tight sm:inline-block">
                {siteConfig.name}
              </span>
            </Link>

            {subtitle && (
              <div className="text-brand-700 bg-brand-50 ring-brand-100 flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1">
                <span className="mr-1.5 text-base">📍</span>
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
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

            <div className="border-border hidden h-6 items-center border-l pl-4 sm:flex">
              <NavAuthWidget />
            </div>

            {/* Mobile nav / hamburger */}
            <div className="flex items-center gap-3 sm:hidden">
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
