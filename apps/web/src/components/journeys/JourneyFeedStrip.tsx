import { FLAGS, isJourneyAllowed } from '@/lib/config';
import { PERSONA_DEFINITIONS } from '@/modules/journeys';
import { JourneyEntryCard } from './JourneyEntryCard';
import { ContinueJourneyChip } from './ContinueJourneyChip';

type Props = {
  citySlug: string;
  cityName: string;
};

/**
 * City-feed entry strip for the Journey Layer (PRD/TDD-0052). Renders the
 * allowlisted journeys for a city as persona entry cards. Server component —
 * returns null (renders nothing) when the flag is off or no journey is live,
 * so it is fully inert until enabled.
 */
export function JourneyFeedStrip({ citySlug, cityName }: Props) {
  if (!FLAGS.journeyLayerEnabled) return null;

  const personas = PERSONA_DEFINITIONS.filter((p) => isJourneyAllowed(citySlug, p.slug));
  if (personas.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Find your path in {cityName}</h2>
          <p className="text-muted text-sm">
            Whether you&apos;re moving here or already settled, follow the steps, communities and
            events that fit your situation.
          </p>
        </div>
        <ContinueJourneyChip
          citySlug={citySlug}
          options={personas.map((p) => ({ slug: p.slug, label: p.label, icon: p.icon }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => (
          <JourneyEntryCard
            key={p.slug}
            citySlug={citySlug}
            personaSlug={p.slug}
            label={p.label}
            tagline={p.tagline}
            icon={p.icon}
            gradient={p.gradient}
            surface="city_feed"
          />
        ))}
      </div>
    </section>
  );
}
