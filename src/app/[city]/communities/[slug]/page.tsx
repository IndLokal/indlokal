import type { Metadata } from 'next';

/**
 * Community Detail Page
 *
 * Route: /[city]/communities/[slug]/
 * Example: /stuttgart/communities/hss-stuttgart/
 *
 * SEO: Dedicated URL, JSON-LD Organization schema, OG tags.
 */

type Props = { params: Promise<{ city: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  // TODO: Fetch community by slug for real metadata
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Community in ${cityName}`,
    description: `Indian community in ${cityName}, Germany — events, access channels, and more.`,
  };
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params;

  // TODO: const community = await getCommunityBySlug(slug);
  // TODO: if (!community) notFound();

  return (
    <div>
      <p className="text-sm text-gray-500">Community: {slug}</p>
      {/* TODO: Full community profile with JSON-LD Organization */}
      <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Community detail page — connect to database
      </div>
    </div>
  );
}
