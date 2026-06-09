import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { FLAGS, isJourneyAllowed } from '@/lib/config';
import { PERSONA_DEFINITIONS } from '@/modules/journeys';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { JourneyEntryCard } from '@/components/journeys/JourneyEntryCard';
import { JOURNEYS_PUBLIC_COPY } from '@/lib/public-site-content';

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Journeys in ${cityName}`,
    description: `Step-by-step journeys for moving to and settling in ${cityName} — pick the path that fits your life stage.`,
    alternates: { canonical: `/${city}/journeys` },
    robots: FLAGS.journeyLayerEnabled ? undefined : { index: false },
  };
}

export default async function CityJourneysHubPage({ params }: Props) {
  const { city } = await params;

  if (!FLAGS.journeyLayerEnabled) notFound();

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const available = PERSONA_DEFINITIONS.filter((p) => isJourneyAllowed(city, p.slug));
  if (available.length === 0) notFound();

  return (
    <div className="space-y-8">
      <CitySubpageHeader
        city={city}
        cityName={cityRow.name}
        sectionLabel="Journeys"
        title={`Journeys in ${cityRow.name}`}
        description={JOURNEYS_PUBLIC_COPY.cityIntro}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((p) => (
          <JourneyEntryCard
            key={p.slug}
            citySlug={city}
            personaSlug={p.slug}
            label={p.label}
            tagline={p.tagline}
            icon={p.icon}
            gradient={p.gradient}
            surface="city_journeys_hub"
          />
        ))}
      </div>
    </div>
  );
}
