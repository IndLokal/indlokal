import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCommunitiesByCity } from '@/modules/community';
import { CommunityCard } from '@/components/CommunityCard';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageCrossLinks } from '@/components/city/CitySubpageCrossLinks';
import { CitySubpageEmptyState } from '@/components/city/CitySubpageEmptyState';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';
import { getSessionUser } from '@/lib/session';

/**
 * Community Explorer - browse communities in a city.
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
      alternates: {
        canonical: `/${city}/${encodeURIComponent(language.toLowerCase())}-communities`,
      },
    };
  }
  if (category) {
    const categoryName = capitalize(category);
    return {
      title: `Indian ${categoryName} Groups in ${cityName}`,
      description: `Discover Indian ${categoryName.toLowerCase()} groups, communities, and organizations in ${cityName}, Germany.`,
      alternates: {
        canonical: `/${city}/${encodeURIComponent(category.toLowerCase())}-groups`,
      },
    };
  }
  return {
    title: `Indian Communities in ${cityName}`,
    description: `Browse Indian communities, associations, and groups in ${cityName}, Germany.`,
    alternates: {
      canonical: `/${city}/communities`,
    },
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
  const savedCommunityIds = new Set(
    user?.savedCommunities.map((s: { communityId: string }) => s.communityId) ?? [],
  );
  type CommunityItem = (typeof allCommunities)[number];

  // Optional language filter (for SEO pages like /telugu-communities)
  const languageName = language ? capitalize(language) : null;
  const communities = languageName
    ? allCommunities.filter(
        (c: CommunityItem) =>
          c.languages?.some((l: string) => l.toLowerCase() === languageName.toLowerCase()) ?? false,
      )
    : allCommunities;

  const description =
    communities.length > 0
      ? languageName
        ? `${communities.length} ${languageName}-speaking communit${communities.length !== 1 ? 'ies' : 'y'}`
        : `${communities.length} active Indian communit${communities.length !== 1 ? 'ies' : 'y'} in ${cityName}, Germany.`
      : languageName
        ? `No ${languageName} communities listed yet.`
        : `No Indian communities listed yet in ${cityName}, Germany.`;

  return (
    <div className="space-y-8">
      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel={languageName ? `${languageName} communities` : 'Communities'}
        title={
          languageName
            ? `${languageName} Communities in ${cityName}`
            : `Indian Communities in ${cityName}`
        }
        description={description}
      />

      {/* Community grid */}
      {communities.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {communities.map((community: CommunityItem) => (
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
        <CitySubpageEmptyState
          title={`No ${languageName} communities yet`}
          description={`Check back soon or browse all ${cityName} communities.`}
          actions={[
            { href: `/${city}/communities`, label: 'Browse all communities', variant: 'primary' },
          ]}
        />
      )}

      {!language && !category && (
        <CitySeoTemplateSection city={city} cityName={cityName} topic="communities" />
      )}

      <CitySubpageCrossLinks
        lead={{
          text: "Don't see your community?",
          href: `/${city}/suggest`,
          label: 'Suggest one →',
        }}
        links={[{ href: `/${city}/events`, label: 'Browse events →' }]}
      />
    </div>
  );
}
