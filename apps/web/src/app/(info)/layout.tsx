import { Footer } from '@/components/layout';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { BrandLink } from '@/components/BrandLink';

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLink hideNameOnMobile />
          <NavAuthWidget />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </>
  );
}
