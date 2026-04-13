import type { Metadata } from 'next';

/**
 * Event Detail Page
 *
 * Route: /[city]/events/[slug]/
 * Example: /stuttgart/events/holi-stuttgart-2026/
 *
 * SEO: Dedicated URL, JSON-LD Event schema, OG tags.
 */

type Props = { params: Promise<{ city: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  // TODO: Fetch event by slug for real metadata
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Event in ${cityName}`,
    description: `Event details — Indian community event in ${cityName}, Germany.`,
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;

  // TODO: const event = await getEventBySlug(slug);
  // TODO: if (!event) notFound();

  return (
    <div>
      <p className="text-sm text-gray-500">Event detail: {slug}</p>
      {/* TODO: Full event detail with JSON-LD */}
      <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Event detail page — connect to database
      </div>
    </div>
  );
}
