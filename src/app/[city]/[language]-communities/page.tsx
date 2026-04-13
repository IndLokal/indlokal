import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { CommunityCard } from '@/components/CommunityCard';

/**
 * Programmatic SEO: Language/Regional Communities
 *
 * Route: /[city]/[language]-communities/
 * Example: /stuttgart/telugu-communities/
 *
 * Targets long-tail queries like "Telugu community Stuttgart"
 */

type Props = { params: Promise<{ city: string; language: string }> };

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, language } = await params;
  if (!language) return { title: 'Not found' };
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? capitalize(city);
  const languageName = capitalize(language);
  return {
    title: `${languageName} Communities in ${cityName}`,
    description: `Find ${languageName} communities, groups, and events in ${cityName}, Germany.`,
  };
}

export default async function LanguageCommunitiesPage({ params }: Props) {
  const { city, language } = await params;

  // Guard: language must exist and must be a valid partial-segment match
  // (e.g. "telugu" from "telugu-communities", NOT undefined from bare "communities")
  if (!language) notFound();

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const languageName = capitalize(language);
  const cityName = cityRow.name;

  // Get all communities in city, then filter by language client-side
  // (Prisma String[] has-filter is supported)
  const allCommunities = await getCommunitiesByCity(city, { limit: 40 });
  const communities = allCommunities.filter(
    (c) => c.languages?.some((l) => l.toLowerCase() === languageName.toLowerCase()) ?? false,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <a href={`/${city}/communities`} className="hover:underline">
            Communities
          </a>
          {' / '}
          <span>{languageName}</span>
        </nav>
        <h1 className="text-3xl font-bold">
          {languageName} Communities in {cityName}
        </h1>
        <p className="mt-2 text-gray-600">
          {communities.length > 0
            ? `${communities.length} ${languageName}-speaking communit${communities.length !== 1 ? 'ies' : 'y'}`
            : `No ${languageName} communities listed yet.`}
        </p>
      </div>

      {communities.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {communities.map((community) => (
            <CommunityCard key={community.id} community={community} city={city} />
          ))}
        </div>
      )}

      {communities.length === 0 && (
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
