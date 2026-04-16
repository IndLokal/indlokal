import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { MobileNav } from '@/components/MobileNav';

type CityLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: CityLayoutProps): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: {
      default: `Indian Communities & Events in ${cityName}`,
      template: `%s — ${cityName} | ${siteConfig.name}`,
    },
    description: `Discover Indian communities, events, and cultural activities in ${cityName}, Germany. Find what's happening this week.`,
  };
}

export default async function CityLayout({ children, params }: CityLayoutProps) {
  const { city } = await params;

  if (!ACTIVE_CITIES.includes(city as (typeof ACTIVE_CITIES)[number])) {
    notFound();
  }

  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <>
      {/* City navigation bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold">
              {siteConfig.name}
            </Link>
            <span className="text-sm text-gray-500">{cityName}</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link href={`/${city}`} className="text-gray-700 hover:text-black">
              Feed
            </Link>
            <Link href={`/${city}/events`} className="text-gray-700 hover:text-black">
              Events
            </Link>
            <Link href={`/${city}/communities`} className="text-gray-700 hover:text-black">
              Communities
            </Link>
            <Link href={`/${city}/resources`} className="text-gray-700 hover:text-black">
              Resources
            </Link>
            <Link
              href={`/${city}/search`}
              className="text-gray-700 hover:text-black"
              aria-label="Search"
            >
              Search
            </Link>
            <Link
              href="/submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
            >
              + Submit
            </Link>
            <NavAuthWidget />
          </nav>

          {/* Mobile nav */}
          <div className="flex items-center gap-2 sm:hidden">
            <NavAuthWidget />
            <MobileNav
              links={[
                { href: `/${city}`, label: 'Feed' },
                { href: `/${city}/events`, label: 'Events' },
                { href: `/${city}/communities`, label: 'Communities' },
                { href: `/${city}/resources`, label: 'Resources' },
                { href: `/${city}/search`, label: 'Search' },
                { href: '/submit', label: '+ Submit', highlight: true },
              ]}
            />
          </div>
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
