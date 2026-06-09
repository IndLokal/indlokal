import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { FLAGS, isJourneyAllowed } from '@/lib/config';
import { PERSONA_DEFINITIONS } from '@/modules/journeys';
import { JourneyEntryCard } from '@/components/journeys/JourneyEntryCard';
import { JOURNEYS_PUBLIC_COPY } from '@/lib/public-site-content';

/**
 * National Journeys hub (PRD/TDD-0052).
 *
 * Route: /journeys
 * Lists every (city × persona) journey that is currently live. Flag-gated;
 * 404s when the Journey Layer is disabled.
 */
export const metadata: Metadata = {
  title: JOURNEYS_PUBLIC_COPY.title,
  description: JOURNEYS_PUBLIC_COPY.description,
  alternates: { canonical: '/journeys' },
};

export default async function NationalJourneysHubPage() {
  if (!FLAGS.journeyLayerEnabled) notFound();

  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  const cityJourneys = cities
    .map((cityRow) => ({
      city: cityRow,
      personas: PERSONA_DEFINITIONS.filter((p) => isJourneyAllowed(cityRow.slug, p.slug)),
    }))
    .filter((c) => c.personas.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-brand-700 text-sm font-medium">Journeys</p>
        <h1 className="text-3xl font-bold">Find your path through Germany</h1>
        <p className="text-muted max-w-2xl">{JOURNEYS_PUBLIC_COPY.intro}</p>
      </header>

      {cityJourneys.length === 0 ? (
        <div className="bg-brand-50/40 rounded-2xl border border-dashed border-black/10 p-8 text-center">
          <p className="text-lg font-semibold">Journeys are launching soon</p>
          <p className="text-muted mx-auto mt-2 max-w-md text-sm">
            We&apos;re curating the first journeys city by city. Check back shortly.
          </p>
        </div>
      ) : (
        cityJourneys.map(({ city, personas }) => (
          <section key={city.slug} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">{city.name}</h2>
              <Link
                href={`/${city.slug}/journeys`}
                className="text-brand-700 text-sm font-medium hover:underline"
              >
                All {city.name} journeys →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {personas.map((p) => (
                <JourneyEntryCard
                  key={p.slug}
                  citySlug={city.slug}
                  personaSlug={p.slug}
                  label={p.label}
                  tagline={p.tagline}
                  icon={p.icon}
                  gradient={p.gradient}
                  surface="national_journeys_hub"
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
