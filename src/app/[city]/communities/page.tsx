import type { Metadata } from 'next';

/**
 * Community Explorer — browse and filter communities in a city.
 *
 * Route: /[city]/communities/
 * Example: /stuttgart/communities/
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Communities in ${cityName}`,
    description: `Browse Indian communities, associations, and groups in ${cityName}, Germany. Filter by category, language, and more.`,
  };
}

export default async function CommunitiesPage({ params }: Props) {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <div>
      <h1 className="text-2xl font-bold">Indian Communities in {cityName}</h1>
      <p className="mt-2 text-gray-600">
        Associations, groups, and organizations for Indians in {cityName} and surrounding areas.
      </p>

      {/* TODO: Filters (category, persona, language) */}
      {/* TODO: Community grid from getCommunitiesByCity(city) */}
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Community explorer with filters — connect to database
      </div>
    </div>
  );
}
