import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/ambassador', label: 'Dashboard' },
  { href: '/ambassador/submit', label: 'Submit' },
  { href: '/ambassador/outreach', label: 'Outreach' },
  { href: '/ambassador/feedback', label: 'Feedback' },
  { href: '/ambassador/me', label: 'My Score' },
];

export default async function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCan('ambassador.read');

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
            <Link href="/ambassador" className="text-lg font-bold">
              Ambassador Console
            </Link>
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
            <Link href="/" className="text-muted hover:text-foreground text-sm transition-colors">
              ← Site
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl">{children}</main>
    </div>
  );
}
