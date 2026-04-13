import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUpcomingEvents } from '@/modules/event/queries';
import { db } from '@/lib/db';
import { EventCard } from '@/components/EventCard';

/**
 * Event Listing — all upcoming events in a city.
 *
 * Route: /[city]/events/
 * Example: /stuttgart/events/
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Events in ${cityName}`,
    description: `Upcoming Indian community events, festivals, and gatherings in ${cityName}, Germany.`,
  };
}

export default async function EventsPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const events = await getUpcomingEvents(city, { limit: 40 });
  const cityName = cityRow.name;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <span>Events</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Events in {cityName}</h1>
        <p className="mt-2 text-gray-600">
          {events.length > 0
            ? `${events.length} upcoming event${events.length !== 1 ? 's' : ''}`
            : 'No upcoming events right now — check back soon.'}
        </p>
      </div>

      {/* Event grid */}
      {events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
      )}
    </div>
  );
}
