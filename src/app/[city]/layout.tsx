import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { siteConfig, ACTIVE_CITIES, UPCOMING_CITIES, SATELLITE_TO_METRO } from '@/lib/config';
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

  const isActive = (ACTIVE_CITIES as readonly string[]).includes(city);
  const isUpcoming = UPCOMING_CITIES.some((c) => c.slug === city);
  const metroRedirect = SATELLITE_TO_METRO[city];

  // Satellite towns redirect to their metro city
  if (metroRedirect) {
    redirect(`/${metroRedirect}`);
  }

  if (!isActive && !isUpcoming) {
    notFound();
  }

  // Upcoming cities: render children directly (coming-soon page handles its own layout)
  if (isUpcoming && !isActive) {
    return <>{children}</>;
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
