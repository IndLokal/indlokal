import type { Metadata } from 'next';

/**
 * Programmatic SEO: Consular Services
 *
 * Route: /[city]/consular-services/
 * Example: /stuttgart/consular-services/
 *
 * Targets: "Indian consulate Stuttgart", "Indian passport Stuttgart"
 */

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Consular Services near ${cityName}`,
    description: `CGI consular camps, passport seva, VFS services, and official Indian government services near ${cityName}, Germany.`,
  };
}

export default async function ConsularServicesPage({ params }: Props) {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);

  // TODO: Fetch resources with type CONSULAR_SERVICE for this city
  return (
    <div>
      <h1 className="text-2xl font-bold">Indian Consular Services near {cityName}</h1>
      <p className="mt-2 text-gray-600">
        Consular camps, passport services, VFS appointments, and official events.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Consular service resources — connect to database
      </div>
    </div>
  );
}
