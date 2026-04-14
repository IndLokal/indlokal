import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { NavAuthWidget } from '@/components/NavAuthWidget';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold">
            {siteConfig.name}
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <NavAuthWidget />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        <p>
          &copy; {new Date().getFullYear()} {siteConfig.name}. Discover Indian communities in
          Germany.
        </p>
      </footer>
    </>
  );
}
