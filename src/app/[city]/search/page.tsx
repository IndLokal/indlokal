import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { searchCommunities, searchEvents } from '@/modules/search/queries';
import { CommunityCard } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import { getSessionUser } from '@/lib/session';
import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

/**
 * Search Results Page
 *
 * Route: /[city]/search?q=...
 * Example: /stuttgart/search?q=telugu
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const { q } = await searchParams;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: q ? `"${q}" — Search ${cityName}` : `Search Indian Communities in ${cityName}`,
    robots: { index: false },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { q } = await searchParams;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityName = cityRow.name;
  const query = q?.trim() ?? '';

  const [results, user] = await Promise.all([
    query.length >= 2
      ? Promise.all([searchCommunities(city, query, 12), searchEvents(city, query, 12)])
      : Promise.resolve([[], []] as [CommunityListItem[], EventListItem[]]),
    getSessionUser(),
  ]);
  const [communities, events] = results;
  const savedCommunityIds = new Set(user?.savedCommunities.map((s) => s.communityId) ?? []);

  const total = communities.length + events.length;

  return (
    <div className="space-y-8">
      {/* Search header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <span>Search</span>
        </nav>
        <h1 className="text-3xl font-bold">Search {cityName}</h1>
      </div>

      {/* Search form — server action redirects to same page with ?q= */}
      <form method="GET" action={`/${city}/search`} className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search communities, events…"
          autoFocus
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {/* Results */}
      {query.length >= 2 && (
        <>
          {total === 0 && (
            <p className="text-gray-500">
              No results for <strong>&ldquo;{query}&rdquo;</strong> in {cityName}.
            </p>
          )}

          {communities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">
                Communities
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({communities.length})
                </span>
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {communities.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    city={city}
                    savedByUser={savedCommunityIds.has(c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">
                Events
                <span className="ml-2 text-sm font-normal text-gray-400">({events.length})</span>
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} city={city} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Empty state — no query yet */}
      {query.length < 2 && (
        <div className="space-y-3 text-sm text-gray-500">
          <p>Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Telugu',
              'Tamil',
              'Holi',
              'Diwali',
              'Navratri',
              'Students',
              'Professionals',
              'HSS',
              'WhatsApp',
            ].map((s) => (
              <a
                key={s}
                href={`/${city}/search?q=${encodeURIComponent(s)}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-600 hover:bg-gray-50"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
