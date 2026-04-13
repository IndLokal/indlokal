import type { Metadata } from 'next';

/**
 * Programmatic SEO: Language/Regional Communities
 *
 * Route: /[city]/[language]-communities/
 * Example: /stuttgart/telugu-communities/
 *
 * Targets long-tail queries like "Telugu community Stuttgart"
 */

type Props = { params: Promise<{ city: string; language: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, language } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  const languageName = language.charAt(0).toUpperCase() + language.slice(1);
  return {
    title: `${languageName} Communities in ${cityName}`,
    description: `Find ${languageName} communities, groups, and events in ${cityName}, Germany. Cultural associations, language groups, and social gatherings.`,
  };
}

export default async function LanguageCommunitiesPage({ params }: Props) {
  const { city, language } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  const languageName = language.charAt(0).toUpperCase() + language.slice(1);

  // TODO: Filter communities by language/regional tag
  return (
    <div>
      <h1 className="text-2xl font-bold">
        {languageName} Communities in {cityName}
      </h1>
      <p className="mt-2 text-gray-600">
        {languageName}-speaking Indian communities, cultural associations, and events in {cityName}{' '}
        and surrounding areas.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
        Filtered community list — connect to database
      </div>
    </div>
  );
}
