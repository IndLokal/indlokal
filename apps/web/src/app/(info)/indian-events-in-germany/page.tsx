import type { Metadata } from 'next';
import Link from 'next/link';
import { ACTIVE_CITIES, getConfiguredCityName, siteConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: `Indian Events in Germany - ${siteConfig.name}`,
  description:
    'Discover upcoming Indian events in Germany by city. Find festivals, meetups, community gatherings, networking events, and cultural programs near you.',
  alternates: {
    canonical: '/indian-events-in-germany',
  },
};

export default function IndianEventsInGermanyPage() {
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Indian events in Germany by city',
    itemListElement: ACTIVE_CITIES.map((city, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `Indian events in ${getConfiguredCityName(city) ?? city}`,
      url: `${siteConfig.url}/${city}/events`,
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
          Indian Events in Germany
        </h1>
        <p className="text-muted mt-4 max-w-3xl leading-relaxed">
          Browse upcoming Indian festivals, community events, business meetups, and cultural
          programs happening across Germany. Explore events city by city.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVE_CITIES.map((city) => {
            const cityName = getConfiguredCityName(city) ?? city;
            return (
              <Link
                key={city}
                href={`/${city}/events`}
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <h2 className="text-foreground text-lg font-semibold">
                  Indian events in {cityName}
                </h2>
                <p className="text-muted mt-2 text-sm">
                  Find upcoming cultural, social, and networking events.
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 p-6 ring-1 ring-black/[0.06]">
          <h2 className="text-foreground text-xl font-bold">
            Looking for Indian communities in Germany?
          </h2>
          <p className="text-muted mt-2 text-sm">
            Explore local Indian associations, language groups, and active communities by city.
          </p>
          <Link
            href="/indian-communities-in-germany"
            className="text-brand-700 mt-4 inline-flex text-sm font-semibold hover:underline"
          >
            View Indian communities in Germany →
          </Link>
        </div>
      </section>
    </>
  );
}
