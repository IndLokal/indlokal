import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { ADMIN_NAV_LINKS } from './nav-links';
import { BrandLink } from '@/components/BrandLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const accountLabel = user.displayName ?? user.email ?? 'Account';
  const accountInitial = accountLabel.charAt(0).toUpperCase();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <BrandLink href="/admin" markSize={32} showName={false} />
            <span className="text-foreground text-lg font-bold">Admin</span>
            <nav className="text-muted hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap text-sm sm:flex">
              {ADMIN_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
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
                  <form action="/admin/logout" method="POST">
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
