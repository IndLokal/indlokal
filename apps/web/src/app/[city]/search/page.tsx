import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  searchCommunities,
  searchEvents,
  searchResources,
  recordSearchInteraction,
} from '@/modules/search';
import { SearchTracker } from '@/components/analytics';
import { getSessionUser } from '@/lib/session';
import type { CommunityListItem } from '@/modules/community';
import type { EventListItem } from '@/modules/event';
import type { ResourceSearchItem } from '@/modules/search';
import { SearchQueryForm } from '@/components/search/SearchQueryForm';
import { SearchResultsSections } from '@/components/search/SearchResultsSections';

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
    title: q ? `"${q}" - Search ${cityName}` : `Search Indian Communities in ${cityName}`,
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
      ? Promise.all([
          searchCommunities(city, query, 12),
          searchEvents(city, query, 12),
          searchResources(city, query, 12),
        ])
      : Promise.resolve([[], [], []] as [
          CommunityListItem[],
          EventListItem[],
          ResourceSearchItem[],
        ]),
    getSessionUser(),
  ]);
  const [communities, events, resources] = results;
  const savedCommunityIds = new Set(user?.savedCommunities.map((s) => s.communityId) ?? []);

  const total = communities.length + events.length + resources.length;

  // Persist a search-query signal for zero-result analytics (PRD/TDD-0048).
  if (query.length >= 2) {
    await recordSearchInteraction({
      userId: user?.id ?? null,
      query,
      scope: 'city',
      entityFilter: 'ALL',
      resultsCount: total,
    });
  }

  return (
    <div className="space-y-8">
      {query.length >= 2 && <SearchTracker query={query} city={city} resultsCount={total} />}
      {/* Search header */}
      <div>
        <nav className="text-muted mb-2 text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityName}
          </Link>
          {' / '}
          <span>Search</span>
        </nav>
        <h1 className="text-3xl font-bold">Search {cityName}</h1>
      </div>

      <SearchQueryForm
        action={`/${city}/search`}
        defaultValue={query}
        placeholder="Search communities, events…"
      />

      {/* Results */}
      {query.length >= 2 && (
        <>
          {total === 0 && (
            <div className="space-y-3">
              <p className="text-muted">
                No results for <strong>&ldquo;{query}&rdquo;</strong> in {cityName}.
              </p>
              <p className="text-muted text-sm">
                Try a different search term, or{' '}
                <Link
                  href={`/${city}/communities`}
                  className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
                >
                  browse all communities
                </Link>
                .
              </p>
            </div>
          )}

          <SearchResultsSections
            citySlugForCards={city}
            savedCommunityIds={savedCommunityIds}
            communities={communities}
            events={events}
            resources={resources}
            resourceFallbackHref={`/${city}/resources`}
          />
        </>
      )}

      {/* Empty state - no query yet */}
      {query.length < 2 && (
        <div className="text-muted space-y-3 text-sm">
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
                className="badge-base text-foreground border-border hover:bg-muted-bg bg-white px-3 py-1 transition-colors"
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
