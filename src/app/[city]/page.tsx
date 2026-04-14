import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityFeed } from '@/modules/discovery/queries';
import { CommunityCard } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import { getSessionUser } from '@/lib/session';

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

  const [feed, user] = await Promise.all([getCityFeed(city), getSessionUser()]);
  if (!feed) notFound();
  const savedCommunityIds = new Set(user?.savedCommunities.map((s) => s.communityId) ?? []);

  const {
    city: cityData,
    thisWeek,
    activeCommunities,
    recentPastEvents,
    categories,
    counts,
  } = feed;
  const cityName = cityData.name;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <h1 className="text-3xl font-bold">Indians in {cityName}</h1>
        <p className="mt-2 text-gray-600">
          {counts.communities} communities · {counts.upcomingEvents} upcoming events
        </p>
      </section>

      {/* This Week */}
      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            {thisWeek.expandedToMonth ? 'This Month' : 'This Week'}
          </h2>
          <a href={`/${city}/events`} className="text-sm text-indigo-600 hover:underline">
            See all events →
          </a>
        </div>
        {thisWeek.events.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No events coming up — check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {thisWeek.events.map((event) => (
              <EventCard key={event.id} event={event} city={city} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Happened */}
      {recentPastEvents.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Recently Happened</h2>
          <p className="mt-1 text-sm text-gray-500">
            Catch up on what&apos;s been active in {cityName}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPastEvents.map((event) => (
              <EventCard key={event.id} event={event} city={city} past />
            ))}
          </div>
        </section>
      )}

      {/* Browse by Category */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Browse by Category</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((cat) => (
              <a
                key={cat.slug}
                href={`/${city}/communities?category=${cat.slug}`}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                <span className="text-xs text-gray-400">
                  {cat.communityCount} communit{cat.communityCount !== 1 ? 'ies' : 'y'}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Active Communities */}
      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">Active Communities</h2>
          <a href={`/${city}/communities`} className="text-sm text-indigo-600 hover:underline">
            See all →
          </a>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activeCommunities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              city={city}
              savedByUser={savedCommunityIds.has(community.id)}
            />
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t see a community?{' '}
          <a href={`/${city}/suggest`} className="text-indigo-600 hover:underline">
            Suggest one →
          </a>
        </p>
      </section>
    </div>
  );
}
