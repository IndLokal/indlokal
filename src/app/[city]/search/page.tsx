import type { Metadata } from 'next';

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
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: q ? `"${q}" — Search ${cityName}` : `Search Indian Communities in ${cityName}`,
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { q } = await searchParams;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {q ? `Results for "${q}" in ${cityName}` : `Search ${cityName}`}
      </h1>

      {/* TODO: Search input + results from searchCommunities / searchEvents */}
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Search results — connect to database
      </div>
    </div>
  );
}
