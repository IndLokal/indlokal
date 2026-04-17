import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { CommunityCard } from '@/components/CommunityCard';
import { getSessionUser } from '@/lib/session';

/**
 * Community Explorer — browse communities in a city.
 * Supports optional ?language= filter for SEO pages
 * (e.g. /stuttgart/telugu-communities → rewritten to /stuttgart/communities?language=telugu)
 *
 * Route: /[city]/communities/
 * Example: /stuttgart/communities/
 * Example: /stuttgart/communities?language=telugu
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ language?: string; category?: string }>;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const { language, category } = await searchParams;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  if (language) {
    const languageName = capitalize(language);
    return {
      title: `${languageName} Communities in ${cityName}`,
      description: `Find ${languageName} communities, groups, and events in ${cityName}, Germany.`,
    };
  }
  if (category) {
    const categoryName = capitalize(category);
    return {
      title: `Indian ${categoryName} Groups in ${cityName}`,
      description: `Discover Indian ${categoryName.toLowerCase()} groups, communities, and organizations in ${cityName}, Germany.`,
    };
  }
  return {
    title: `Indian Communities in ${cityName}`,
    description: `Browse Indian communities, associations, and groups in ${cityName}, Germany.`,
  };
}

export default async function CommunitiesPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { language, category } = await searchParams;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const [allCommunities, user] = await Promise.all([
    getCommunitiesByCity(city, { categorySlug: category, limit: 24 }),
    getSessionUser(),
  ]);
  const cityName = cityRow.name;
  const savedCommunityIds = new Set(user?.savedCommunities.map((s) => s.communityId) ?? []);

  // Optional language filter (for SEO pages like /telugu-communities)
  const languageName = language ? capitalize(language) : null;
  const communities = languageName
    ? allCommunities.filter(
        (c) =>
          c.languages?.some((l: string) => l.toLowerCase() === languageName.toLowerCase()) ?? false,
      )
    : allCommunities;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="text-muted mb-2 text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityName}
          </Link>
          {' / '}
          {languageName ? (
            <>
              <Link href={`/${city}/communities`} className="hover:underline">
                Communities
              </Link>
              {' / '}
              <span>{languageName}</span>
            </>
          ) : (
            <span>Communities</span>
          )}
        </nav>
        <h1 className="text-3xl font-bold">
          {languageName
            ? `${languageName} Communities in ${cityName}`
            : `Indian Communities in ${cityName}`}
        </h1>
        <p className="text-muted mt-2">
          {communities.length > 0
            ? languageName
              ? `${communities.length} ${languageName}-speaking communit${communities.length !== 1 ? 'ies' : 'y'}`
              : `${communities.length} active communit${communities.length !== 1 ? 'ies' : 'y'}`
            : languageName
              ? `No ${languageName} communities listed yet.`
              : 'No communities listed yet.'}
        </p>
      </div>

      {/* Community grid */}
      {communities.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              city={city}
              savedByUser={savedCommunityIds.has(community.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state for language filter */}
      {languageName && communities.length === 0 && (
        <div className="border-border text-muted rounded-[var(--radius-card)] border border-dashed p-10 text-center">
          <p className="text-lg">No {languageName} communities yet</p>
          <p className="mt-1 text-sm">Check back soon or browse all {cityName} communities.</p>
          <a
            href={`/${city}/communities`}
            className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
          >
            Browse all communities
          </a>
        </div>
      )}

      {/* Cross-links */}
      <div className="border-border/50 bg-muted-bg text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border p-4 text-sm">
        <span>
          Don&apos;t see your community?{' '}
          <Link
            href={`/${city}/suggest`}
            className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
          >
            Suggest one →
          </Link>
        </span>
        <span className="text-border hidden sm:inline">|</span>
        <Link
          href={`/${city}/events`}
          className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
        >
          Browse events →
        </Link>
      </div>
    </div>
  );
}
