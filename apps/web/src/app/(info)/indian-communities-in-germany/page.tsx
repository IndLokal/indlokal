import type { Metadata } from 'next';
import Link from 'next/link';
import { ACTIVE_CITIES, getConfiguredCityName, siteConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: `Indian Communities in Germany - ${siteConfig.name}`,
  description:
    'Discover active Indian communities in Germany by city. Explore cultural groups, associations, language communities, and local networks near you.',
  alternates: {
    canonical: '/indian-communities-in-germany',
  },
};

export default function IndianCommunitiesInGermanyPage() {
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Indian communities in Germany by city',
    itemListElement: ACTIVE_CITIES.map((city, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `Indian communities in ${getConfiguredCityName(city) ?? city}`,
      url: `${siteConfig.url}/${city}/communities`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h1 className="text-foreground text-3xl font-extrabold sm:text-4xl">
          Indian Communities in Germany
        </h1>
        <p className="text-muted mt-4 max-w-3xl leading-relaxed">
          Find active Indian communities, associations, and local groups across Germany. Browse by
          city and connect with cultural, language, student, family, and professional communities.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVE_CITIES.map((city) => {
            const cityName = getConfiguredCityName(city) ?? city;
            return (
              <Link
                key={city}
                href={`/${city}/communities`}
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <h2 className="text-foreground text-lg font-semibold">
                  Indian communities in {cityName}
                </h2>
                <p className="text-muted mt-2 text-sm">
                  Explore groups, associations, and active local networks.
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 p-6 ring-1 ring-black/[0.06]">
          <h2 className="text-foreground text-xl font-bold">
            Also exploring Indian events in Germany?
          </h2>
          <p className="text-muted mt-2 text-sm">
            See upcoming events, meetups, festivals, and networking programs by city.
          </p>
          <Link
            href="/indian-events-in-germany"
            className="text-brand-700 mt-4 inline-flex text-sm font-semibold hover:underline"
          >
            View Indian events in Germany →
          </Link>
        </div>
      </section>
    </>
  );
}
