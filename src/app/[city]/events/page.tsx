import type { Metadata } from 'next';

/**
 * Event Listing — time-filtered events in a city.
 *
 * Route: /[city]/events/
 * Example: /stuttgart/events/
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Events in ${cityName}`,
    description: `Upcoming Indian community events, festivals, and gatherings in ${cityName}, Germany.`,
  };
}

export default async function EventsPage({ params }: Props) {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <div>
      <h1 className="text-2xl font-bold">Indian Events in {cityName}</h1>
      <p className="mt-2 text-gray-600">Upcoming events, festivals, and gatherings.</p>

      {/* TODO: Filters (time, category, cost, type) */}
      {/* TODO: Event list from getUpcomingEvents(city) */}
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Event listing with filters — connect to database
      </div>
    </div>
  );
}
