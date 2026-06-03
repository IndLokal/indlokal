import type { Metadata } from 'next';
import Link from 'next/link';
import {
  searchCommunities,
  searchEvents,
  searchResources,
  recordSearchInteraction,
} from '@/modules/search';
import { CommunityCard } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import { SearchTracker } from '@/components/analytics';
import { getSessionUser } from '@/lib/session';
import type { CommunityListItem } from '@/modules/community';
import type { EventListItem } from '@/modules/event';
import type { ResourceSearchItem } from '@/modules/search';

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
    title: q ? `"${q}" - Search across Germany` : 'Search Indian communities across Germany',
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

      <form method="GET" action="/search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search communities, events, resources…"
          autoFocus
          className="border-border text-foreground focus:border-brand-500 focus:ring-brand-100 flex-1 rounded-[var(--radius-card)] border px-4 py-3 text-base transition-colors outline-none focus:ring-2"
        />
        <button
          type="submit"
          className="btn-primary rounded-[var(--radius-card)] px-6 py-3 text-sm"
        >
          Search
        </button>
      </form>

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

          {communities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">
                Communities
                <span className="text-muted ml-2 text-sm font-normal">({communities.length})</span>
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {communities.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    city={c.city.slug}
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
                <span className="text-muted ml-2 text-sm font-normal">({events.length})</span>
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} city={e.city.slug} />
                ))}
              </div>
            </section>
          )}

          {resources.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">
                Resources & guides
                <span className="text-muted ml-2 text-sm font-normal">({resources.length})</span>
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {resources.map((r) => (
                  <a
                    key={r.id}
                    href={r.url ?? '#'}
                    {...(r.url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="card-base hover:border-brand-300 block p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-foreground text-sm font-semibold">{r.title}</h3>
                      {r.isEssential && (
                        <span className="badge-base border-brand-200 text-brand-700 bg-brand-50 shrink-0 px-2 py-0.5 text-xs">
                          Essential
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-muted mt-1 line-clamp-2 text-sm">{r.description}</p>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
