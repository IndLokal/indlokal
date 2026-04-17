import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES, UPCOMING_CITIES } from '@/lib/config';

const NAV_COLUMNS = [
  {
    title: 'Cities',
    links: [
      ...ACTIVE_CITIES.map((city) => ({
        label: city.charAt(0).toUpperCase() + city.slice(1),
        href: `/${city}`,
      })),
      ...UPCOMING_CITIES.slice(0, 4).map((city) => ({
        label: `${city.name} ⁽ˢᵒᵒⁿ⁾`,
        href: `/${city.slug}`,
      })),
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Suggest Community', href: '/submit' },
      { label: 'Organizer Dashboard', href: '/organizer/login' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Impressum', href: '/impressum' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border/50 mt-16 border-t bg-gradient-to-b from-white to-slate-50">
      {/* Main footer content */}
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(4,1fr)] lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="space-y-5 md:pr-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <span className="from-brand-500 to-brand-700 shadow-brand-500/20 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-md">
                L
              </span>
              <span className="text-foreground text-lg font-bold tracking-tight">
                {siteConfig.name}
              </span>
            </Link>
            <p className="text-muted max-w-xs text-sm leading-relaxed">
              Connecting the Indian diaspora with communities, events, and resources across Germany.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://instagram.com/localpulse.de"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-muted hover:bg-brand-50 hover:text-brand-600 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 transition-all hover:scale-105"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com/company/localpulse"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-muted hover:bg-brand-50 hover:text-brand-600 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 transition-all hover:scale-105"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {NAV_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-foreground/70 mb-4 text-xs font-semibold tracking-wider uppercase">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted hover:text-brand-600 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-border/40 border-t bg-slate-50/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-muted/80 text-xs">
            &copy; {new Date().getFullYear()} {siteConfig.name}. Made with ❤️ for Indians in
            Germany.
          </p>
          <div className="text-muted/80 flex flex-wrap items-center gap-1 text-xs">
            <Link
              href="/privacy"
              className="hover:text-foreground rounded px-2 py-0.5 transition-colors hover:bg-slate-100"
            >
              Privacy
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/terms"
              className="hover:text-foreground rounded px-2 py-0.5 transition-colors hover:bg-slate-100"
            >
              Terms
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/impressum"
              className="hover:text-foreground rounded px-2 py-0.5 transition-colors hover:bg-slate-100"
            >
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
