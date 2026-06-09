import type { Metadata } from 'next';
import Link from 'next/link';
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
 * National (all-Germany) search results page (PRD/TDD-0048).
 *
 * Route: /search?q=...
 * Need-first discovery: spans communities, events and resources across every
 * city, not scoped to one. The per-city route /[city]/search remains for
 * city-scoped search.
 */

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q
      ? `"${q}" - Search across Germany`
      : 'Search Indian communities, events & resources across Germany',
    robots: { index: false },
  };
}

export default async function NationalSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const [results, user] = await Promise.all([
    query.length >= 2
      ? Promise.all([
          // No city slug → all of Germany (ADR-0010).
          searchCommunities(undefined, query, 18),
          searchEvents(undefined, query, 18),
          searchResources(undefined, query, 18),
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

  if (query.length >= 2) {
    await recordSearchInteraction({
      userId: user?.id ?? null,
      query,
      scope: 'national',
      entityFilter: 'ALL',
      resultsCount: total,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {query.length >= 2 && <SearchTracker query={query} city="all" resultsCount={total} />}

      <div>
        <h1 className="text-3xl font-bold">Search across Germany</h1>
        <p className="text-muted mt-1 text-sm">
          Communities, events and resources for the Indian diaspora — everywhere in Germany.
        </p>
      </div>

      <SearchQueryForm
        action="/search"
        defaultValue={query}
        placeholder="Search communities, events, resources…"
      />

      {query.length >= 2 && (
        <>
          {total === 0 && (
            <div className="space-y-3">
              <p className="text-muted">
                No results for <strong>&ldquo;{query}&rdquo;</strong> across Germany.
              </p>
              <p className="text-muted text-sm">
                Try a different term, or{' '}
                <Link
                  href="/stuttgart/communities"
                  className="text-brand-600 font-medium hover:underline"
                >
                  browse communities
                </Link>
                .
              </p>
            </div>
          )}

          <SearchResultsSections
            savedCommunityIds={savedCommunityIds}
            communities={communities}
            events={events}
            resources={resources}
            resourceFallbackHref="#"
          />
        </>
      )}
    </div>
  );
}
