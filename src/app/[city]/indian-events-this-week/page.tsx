import type { Metadata } from 'next';

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
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Events This Week in ${cityName}`,
    description: `What's happening for Indians in ${cityName} this week? Upcoming events, festivals, meetups, and community gatherings.`,
  };
}

export default async function IndianEventsThisWeekPage({ params }: Props) {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  // TODO: getEventsThisWeek(city)
  return (
    <div>
      <h1 className="text-2xl font-bold">Indian Events This Week in {cityName}</h1>
      <p className="mt-2 text-gray-600">
        Community events, cultural gatherings, and activities happening this week.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        This week&apos;s events — connect to database
      </div>
    </div>
  );
}
