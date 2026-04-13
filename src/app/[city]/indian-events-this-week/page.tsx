import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format, endOfWeek, endOfMonth } from 'date-fns';
import { db } from '@/lib/db';
import { getEventsThisWeek } from '@/modules/event/queries';
import { EventCard } from '@/components/EventCard';

/**
 * Programmatic SEO: Indian Events This Week
 *
 * Route: /[city]/indian-events-this-week/
 * Example: /stuttgart/indian-events-this-week/
 *
 * Targets: "Indian events Stuttgart this week"
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');
  return {
    title: `Indian Events This Week in ${cityName} (until ${weekEnd})`,
    description: `What's happening for Indians in ${cityName} this week? Upcoming community events, festivals, meetups, and cultural gatherings.`,
  };
}

export default async function IndianEventsThisWeekPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityName = cityRow.name;
  const { events, expandedToMonth } = await getEventsThisWeek(city);

  const now = new Date();
  const windowEnd = expandedToMonth ? endOfMonth(now) : endOfWeek(now, { weekStartsOn: 1 });
  const windowLabel = expandedToMonth
    ? `this month (until ${format(windowEnd, 'MMMM d')})`
    : `this week (until ${format(windowEnd, 'EEEE, MMM d')})`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <span>Events this week</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Events This Week in {cityName}</h1>
        <p className="mt-2 text-gray-600">
          {events.length > 0
            ? `${events.length} event${events.length !== 1 ? 's' : ''} ${windowLabel}`
            : `No events found ${windowLabel} — check back soon.`}
        </p>
      </div>

      {events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
      )}

      {/* CTA to all events */}
      <div className="border-t border-gray-100 pt-6">
        <a href={`/${city}/events`} className="text-sm font-medium text-indigo-600 hover:underline">
          See all upcoming events in {cityName} →
        </a>
      </div>
    </div>
  );
}
