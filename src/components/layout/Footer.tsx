import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';

export function Footer() {
  return (
    <footer className="border-border/50 to-muted-bg mt-12 border-t bg-gradient-to-b from-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <span className="from-brand-500 to-brand-700 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white shadow-sm">
                L
              </span>
              <span className="text-foreground font-bold tracking-tight">{siteConfig.name}</span>
            </Link>
            <p className="text-muted text-sm leading-relaxed">
              The central hub for Indian expats to discover communities, events, and resources in
              Germany.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div className="space-y-3 text-sm">
              <h4 className="text-foreground font-semibold">Cities</h4>
              <div className="text-muted flex flex-col space-y-2">
                {ACTIVE_CITIES.map((city) => (
                  <Link
                    key={city}
                    href={`/${city}`}
                    className="hover:text-brand-600 capitalize transition-colors"
                  >
                    {city}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <h4 className="text-foreground font-semibold">Explore</h4>
              <div className="text-muted flex flex-col space-y-2">
                <Link href="/submit" className="hover:text-brand-600 transition-colors">
                  Suggest Community
                </Link>
                <Link href="/organizer/login" className="hover:text-brand-600 transition-colors">
                  Organizer Dashboard
                </Link>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <h4 className="text-foreground font-semibold">Platform</h4>
              <div className="text-muted flex flex-col space-y-2">
                <Link href="/" className="hover:text-brand-600 transition-colors">
                  About LocalPulse
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-border/40 mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-muted text-sm">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="text-muted flex gap-6 text-sm">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
