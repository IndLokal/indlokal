import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { CommunityCard } from '@/components/CommunityCard';

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
  searchParams: Promise<{ language?: string }>;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const { language } = await searchParams;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  if (language) {
    const languageName = capitalize(language);
    return {
      title: `${languageName} Communities in ${cityName}`,
      description: `Find ${languageName} communities, groups, and events in ${cityName}, Germany.`,
    };
  }
  return {
    title: `Indian Communities in ${cityName}`,
    description: `Browse Indian communities, associations, and groups in ${cityName}, Germany.`,
  };
}

export default async function CommunitiesPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { language } = await searchParams;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const allCommunities = await getCommunitiesByCity(city, { limit: 40 });
  const cityName = cityRow.name;

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
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          {languageName ? (
            <>
              <a href={`/${city}/communities`} className="hover:underline">
                Communities
              </a>
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
        <p className="mt-2 text-gray-600">
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
            <CommunityCard key={community.id} community={community} city={city} />
          ))}
        </div>
      )}

      {/* Empty state for language filter */}
      {languageName && communities.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          <p className="text-lg">No {languageName} communities yet</p>
          <p className="mt-1 text-sm">Check back soon or browse all {cityName} communities.</p>
          <a
            href={`/${city}/communities`}
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Browse all communities
          </a>
        </div>
      )}
    </div>
  );
}
