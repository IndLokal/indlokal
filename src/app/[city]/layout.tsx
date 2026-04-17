import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';
import { AppShell } from '@/components/layout';

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

  const navLinks = [
    { href: `/${city}`, label: 'Feed' },
    { href: `/${city}/events`, label: 'Events' },
    { href: `/${city}/communities`, label: 'Communities' },
    { href: `/${city}/resources`, label: 'Resources' },
    { href: `/${city}/search`, label: 'Search' },
    { href: '/submit', label: '+ Submit', highlight: true },
  ];

  return (
    <AppShell subtitle={cityName} navLinks={navLinks}>
      {children}
    </AppShell>
  );
}
