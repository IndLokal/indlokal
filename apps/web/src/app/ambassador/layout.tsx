import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { BrandLink } from '@/components/BrandLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/ambassador', label: 'Dashboard' },
  { href: '/ambassador/submit', label: 'Submit' },
  { href: '/ambassador/outreach', label: 'Outreach' },
  { href: '/ambassador/feedback', label: 'Feedback' },
  { href: '/ambassador/me', label: 'My Score' },
];

export default async function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCan('ambassador.read');
  const accountLabel = user.displayName ?? user.email ?? 'Account';
  const accountInitial = accountLabel.charAt(0).toUpperCase();

  // Resolve the ambassador's city scopes from active RoleAssignments
  const cityScopes = user.roleAssignments
    .filter((a) => a.role === 'CITY_AMBASSADOR' && a.cityId && !a.revokedAt)
    .map((a) => a.cityId as string);

  // PLATFORM_ADMIN / OPS_LEAD fall-through: no city scope required
  if (cityScopes.length === 0 && user.role !== 'PLATFORM_ADMIN' && user.role !== 'OPS_LEAD') {
    redirect('/admin');
  }

  // Resolve city name for header display
  let cityLabel = 'All Cities';
  if (cityScopes.length === 1) {
    const city = await db.city.findUnique({
      where: { id: cityScopes[0] },
      select: { name: true },
    });
    if (city) cityLabel = city.name;
  } else if (cityScopes.length > 1) {
    cityLabel = `${cityScopes.length} cities`;
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <BrandLink href="/ambassador" markSize={32} showName={false} />
            <span className="text-foreground text-lg font-bold">Ambassador Console</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              {cityLabel}
            </span>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              {NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted hover:bg-muted-bg hover:text-foreground rounded-[var(--radius-button)] px-3 py-1.5 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted hidden max-w-[180px] truncate text-xs sm:inline">
              {user.role === 'PLATFORM_ADMIN' ? '(admin preview)' : ''}
            </span>
            <details className="group relative">
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
                  <Link
                    href="/me"
                    className="hover:bg-muted-bg text-muted hover:text-foreground block w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm font-medium transition-colors"
                  >
                    My profile
                  </Link>
                  <Link
                    href="/"
                    className="hover:bg-muted-bg text-muted hover:text-foreground block w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm font-medium transition-colors"
                  >
                    Public site
                  </Link>
                  <form action="/organizer/logout" method="POST">
                    <button
                      type="submit"
                      className="hover:bg-muted-bg text-muted hover:text-destructive w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm font-medium transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl">{children}</main>
    </div>
  );
}
