import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { isJourneyAllowed } from '@/lib/config';
import {
  composeJourney,
  getPersonaBySlug,
  PERSONA_DEFINITIONS,
  STAGE_META,
  type JourneyBlock,
  type JourneyStageBlock,
} from '@/modules/journeys';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { JourneyViewTracker } from '@/components/journeys/JourneyViewTracker';
import { JourneyBlockLink } from '@/components/journeys/JourneyBlockLink';
import { JourneySaveButton } from '@/components/journeys/JourneySaveButton';
import { JourneyBlockDone } from '@/components/journeys/JourneyBlockDone';
import { PersonaSwitcher, type PersonaOption } from '@/components/journeys/PersonaSwitcher';

type Props = { params: Promise<{ city: string; persona: string }> };

const ENTITY_ICON: Record<string, string> = {
  resource: '📄',
  community: '🤝',
  event: '📅',
  checklist: '✅',
  ecosystem: '🌐',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, persona } = await params;
  const def = getPersonaBySlug(persona);
  if (!def) return {};
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `${def.label} Journey in ${cityName}`,
    description: `A step-by-step journey for ${def.label.toLowerCase()}s moving to ${cityName}: ${def.tagline}`,
    alternates: { canonical: `/${city}/journeys/${persona}` },
    robots: isJourneyAllowed(city, persona) ? undefined : { index: false },
  };
}

export default async function JourneyPersonaPage({ params }: Props) {
  const { city, persona } = await params;

  const def = getPersonaBySlug(persona);
  if (!def) notFound();

  // Flag + allowlist gate. When disabled the route does not exist.
  if (!isJourneyAllowed(city, def.slug)) notFound();

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const view = await composeJourney({
    persona: def.persona,
    citySlug: city,
    cityName: cityRow.name,
  });

  // Personas this city actually offers (allowlisted) — drives the switcher.
  const switcherOptions: PersonaOption[] = PERSONA_DEFINITIONS.filter((p) =>
    isJourneyAllowed(city, p.slug),
  ).map((p) => ({ persona: p.persona, slug: p.slug, label: p.label, icon: p.icon }));

  return (
    <div className="space-y-8">
      <JourneyViewTracker
        citySlug={city}
        persona={def.persona}
        personaSlug={def.slug}
        blockCount={view.blockCount}
        promoted={view.promoted}
        stages={view.stages.map((s) => s.stage)}
      />

      <CitySubpageHeader
        city={city}
        cityName={cityRow.name}
        sectionLabel={`Journeys / ${def.label}`}
        title={`${def.label} journey in ${cityRow.name}`}
        description={def.tagline}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {switcherOptions.length > 1 ? (
          <PersonaSwitcher citySlug={city} current={def.slug} options={switcherOptions} />
        ) : (
          <span />
        )}
        <JourneySaveButton citySlug={city} persona={def.persona} personaSlug={def.slug} />
      </div>

      {view.blockCount === 0 ? (
        <EmptyJourney cityName={cityRow.name} personaLabel={def.label} />
      ) : (
        <div className="space-y-10">
          {view.stages.map((stage) => (
            <JourneyStageSection
              key={stage.stage}
              citySlug={city}
              personaSlug={def.slug}
              stage={stage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyStageSection({
  citySlug,
  personaSlug,
  stage,
}: {
  citySlug: string;
  personaSlug: string;
  stage: JourneyStageBlock;
}) {
  const meta = STAGE_META[stage.stage];
  return (
    <section data-journey-stage={stage.stage} className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="bg-brand-100 text-brand-800 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {stage.stageIndex + 1}
        </span>
        <div>
          <h2 className="text-xl font-semibold">{meta.label}</h2>
          <p className="text-muted text-sm">{meta.blurb}</p>
        </div>
      </div>
      <ol className="space-y-3 border-l border-black/[0.06] pl-5">
        {stage.blocks.map((block, i) => (
          <JourneyBlockCard
            key={`${block.entityKind}:${block.entityId ?? i}`}
            citySlug={citySlug}
            personaSlug={personaSlug}
            stage={stage.stage}
            block={block}
          />
        ))}
      </ol>
    </section>
  );
}

function JourneyBlockCard({
  citySlug,
  personaSlug,
  stage,
  block,
}: {
  citySlug: string;
  personaSlug: string;
  stage: string;
  block: JourneyBlock;
}) {
  return (
    <li className="relative rounded-xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {block.entityKind === 'resource' && block.entityId ? (
          <JourneyBlockDone
            citySlug={citySlug}
            personaSlug={personaSlug}
            blockId={block.entityId}
          />
        ) : (
          <span className="mt-0.5 text-lg" aria-hidden>
            {ENTITY_ICON[block.entityKind] ?? '•'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground font-medium">{block.title}</h3>
            {block.badge && (
              <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
                {block.badge}
              </span>
            )}
          </div>
          {block.summary && <p className="text-muted mt-1 text-sm">{block.summary}</p>}
          <div className="mt-3">
            <JourneyBlockLink
              href={block.action.href ?? '#'}
              label={block.action.label}
              external={block.action.external}
              citySlug={citySlug}
              personaSlug={personaSlug}
              entityKind={block.entityKind}
              entityId={block.entityId}
              stage={stage}
              className="text-brand-700 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyJourney({ cityName, personaLabel }: { cityName: string; personaLabel: string }) {
  return (
    <div className="bg-brand-50/40 rounded-2xl border border-dashed border-black/10 p-8 text-center">
      <p className="text-lg font-semibold">This journey is still taking shape</p>
      <p className="text-muted mx-auto mt-2 max-w-md text-sm">
        We&apos;re curating the {personaLabel.toLowerCase()} journey for {cityName}. Check back soon
        — in the meantime, explore resources and communities from the menu above.
      </p>
    </div>
  );
}
