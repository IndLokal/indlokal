import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { CommunityCard } from '@/components/CommunityCard';

/**
 * Community Explorer — browse communities in a city.
 *
 * Route: /[city]/communities/
 * Example: /stuttgart/communities/
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Communities in ${cityName}`,
    description: `Browse Indian communities, associations, and groups in ${cityName}, Germany.`,
  };
}

export default async function CommunitiesPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const communities = await getCommunitiesByCity(city, { limit: 40 });
  const cityName = cityRow.name;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <span>Communities</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Communities in {cityName}</h1>
        <p className="mt-2 text-gray-600">
          {communities.length > 0
            ? `${communities.length} active communit${communities.length !== 1 ? 'ies' : 'y'}`
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
    </div>
  );
}
