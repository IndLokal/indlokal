import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { discovery as d } from '@indlokal/shared';
import { db } from '@/lib/db';
import { getUpcomingEvents } from '@/modules/event';
import { EventCard } from '@/components/EventCard';
import { BusinessLensTracker } from '@/components/analytics';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageCrossLinks } from '@/components/city/CitySubpageCrossLinks';

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Business and Careers Events in ${cityName}`,
    description: `Discover Indian business networking, professional meetups, startup gatherings, and career events in ${cityName}.`,
  };
}

export default async function BusinessEventsPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const events = await getUpcomingEvents(city, {
    categorySlugs: [...d.BUSINESS_EVENT_CATEGORY_SLUGS],
    limit: 24,
  });

  const cityName = cityRow.name;
  const description =
    events.length > 0
      ? `${events.length} upcoming professional and networking events`
      : `No business events listed right now in ${cityName}.`;

  return (
    <div className="space-y-8">
      <BusinessLensTracker city={city} surface="business_events_page" />

      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel="Business events"
        title={`Business and Careers Events in ${cityName}`}
        description={description}
      />

      {events.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
      ) : (
        <div className="border-border rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted text-lg">No business events yet</p>
          <p className="text-muted mt-1 text-sm">
            Try the full events feed or browse active communities for upcoming updates.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/${city}/events`} className="btn-primary inline-block px-4 py-2 text-sm">
              View all events
            </Link>
            <Link
              href={`/${city}/communities`}
              className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline"
            >
              Browse communities
            </Link>
          </div>
        </div>
      )}

      <CitySubpageCrossLinks
        links={[
          { href: `/${city}/events`, label: 'All events →' },
          { href: `/${city}/resources/business-setup`, label: 'Business setup resources →' },
        ]}
      />
    </div>
  );
}
