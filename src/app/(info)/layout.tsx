import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { Footer } from '@/components/layout';
import { NavAuthWidget } from '@/components/NavAuthWidget';

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <span className="from-brand-500 to-brand-700 shadow-brand-500/20 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md">
              L
            </span>
            <span className="text-foreground text-xl font-bold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
          <NavAuthWidget />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </>
  );
}
