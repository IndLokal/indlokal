import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { ADMIN_NAV_LINKS } from './page';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold">
              IndLokal Admin
            </Link>
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              {ADMIN_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-muted hidden max-w-[180px] truncate text-xs sm:inline"
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
      {children}
    </div>
  );
}
