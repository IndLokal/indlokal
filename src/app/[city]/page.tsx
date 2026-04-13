import type { Metadata } from 'next';

/**
 * City Feed — the primary discovery surface.
 * Activity-led, not directory-led.
 *
 * Route: /[city]/
 * Example: /stuttgart/
 */

type CityFeedPageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: CityFeedPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Communities & Events in ${cityName}`,
    description: `What's happening for Indians in ${cityName} this week? Discover communities, events, and activities.`,
  };
}

export default async function CityFeedPage({ params }: CityFeedPageProps) {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  // TODO: Replace with getCityFeed(city) when DB is connected
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <h1 className="text-3xl font-bold">What&apos;s happening for Indians in {cityName}</h1>
        <p className="mt-2 text-gray-600">Communities, events, and activities — updated weekly.</p>
      </section>

      {/* This Week */}
      <section>
        <h2 className="text-xl font-semibold">This Week</h2>
        <p className="mt-2 text-sm text-gray-500">Events coming up in the next 7 days</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Event cards will go here */}
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Event cards load here
          </div>
        </div>
      </section>

      {/* Active Communities */}
      <section>
        <h2 className="text-xl font-semibold">Active Communities</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Community cards load here
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section>
        <h2 className="text-xl font-semibold">Browse by Category</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { icon: '🎭', name: 'Cultural' },
            { icon: '🎓', name: 'Student' },
            { icon: '💼', name: 'Professional' },
            { icon: '🙏', name: 'Religious' },
            { icon: '🗣️', name: 'Language' },
            { icon: '⚽', name: 'Sports' },
            { icon: '👨‍👩‍👧', name: 'Family' },
            { icon: '🤝', name: 'Networking' },
            { icon: '🍛', name: 'Food' },
            { icon: '🎵', name: 'Arts' },
            { icon: '🏛️', name: 'Consular' },
          ].map((cat) => (
            <div
              key={cat.name}
              className="flex flex-col items-center rounded-lg border border-gray-200 p-3 text-sm transition-colors hover:bg-gray-50"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="mt-1">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
