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
            <span
              className="text-muted hidden max-w-[180px] truncate text-xs xl:inline"
              title={user.email}
            >
              {user.email}
            </span>
            <Link href="/" className="text-muted hover:text-foreground text-sm transition-colors">
              ← Back to site
            </Link>
            <form action="/admin/logout" method="POST">
              <button
                type="submit"
                className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-md border px-2.5 py-1 text-xs transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl">{children}</main>
    </div>
  );
}
