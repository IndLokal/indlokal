import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ResourceStage } from '@prisma/client';
import { db } from '@/lib/db';
import { FLAGS } from '@/lib/config/flags';
import { RESOURCE_CATEGORIES } from '@/lib/config';
import { getResourcesForCity, type ResolvedResource } from '@/modules/resources';
import { JourneyNextBestAction } from './JourneyNextBestAction';

/**
 * Newcomer Journey - essentials-only resources grouped by lifecycle stage.
 *
 * Route: /[city]/resources/journey
 *
 * Same shape as GET /api/v1/cities/:slug/resources/journey but rendered
 * server-side for SEO + first-paint.
 */

type Props = { params: Promise<{ city: string }> };

const STAGE_ORDER: ResourceStage[] = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
];

const STAGE_LABELS: Record<ResourceStage, { title: string; blurb: string; icon: string }> = {
  PRE_ARRIVAL: {
    title: 'Before You Arrive',
    blurb: 'Paperwork to line up while you are still in India.',
    icon: '✈️',
  },
  FIRST_30_DAYS: {
    title: 'First 30 Days',
    blurb: 'Anmeldung, residence permit, health insurance - the legal essentials.',
    icon: '📋',
  },
  FIRST_90_DAYS: {
    title: 'First 90 Days',
    blurb: 'Tax setup, bank accounts, family/school registration.',
    icon: '🗓️',
  },
  SETTLED: {
    title: 'Settling In',
    blurb: 'Long-term residence, permanent residence, career moves.',
    icon: '🏠',
  },
  ANYTIME: {
    title: 'Anytime',
    blurb: 'Useful any time you live in Germany.',
    icon: '🇩🇪',
  },
};

const OFFICIAL_TYPES = new Set([
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
]);

function isStale(validUntil: Date | null): boolean {
  return Boolean(validUntil && validUntil.getTime() < Date.now());
}

function trustLabel(resourceType: string): string {
  return OFFICIAL_TYPES.has(resourceType) ? 'Official' : 'Curated';
}

function buildResourceHref(city: string, resource: ResolvedResource): string {
  const categorySlug =
    RESOURCE_CATEGORIES.find((category) => category.type === resource.resourceType)?.slug ??
    'city-registration';
  return `/${city}/resources/${categorySlug}#${resource.slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Newcomer Journey - Indian Expat Checklist for ${cityName}`,
    description: `Step-by-step checklist of the official things Indian newcomers in ${cityName} need to do - pre-arrival through first 90 days.`,
  };
}

function ItemCard({ r, city }: { r: ResolvedResource; city: string }) {
  const cat = RESOURCE_CATEGORIES.find((c) => c.type === r.resourceType);
  return (
    <li>
      <Link
        href={buildResourceHref(city, r)}
        className="hover:ring-brand-200 group flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${cat?.color ?? 'from-slate-400 to-slate-500'} text-base shadow-sm`}
        >
          {cat?.icon ?? '✓'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground group-hover:text-brand-600 text-[15px] font-semibold transition-colors">
            {r.title}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              {trustLabel(r.resourceType)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isStale(r.validUntil)
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isStale(r.validUntil) ? 'Needs review' : 'Fresh'}
            </span>
          </div>
          {r.description && (
            <p className="text-muted mt-1 line-clamp-2 text-[13px] leading-relaxed">
              {r.description}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

export default async function JourneyPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();
  const cityName = cityRow.name;

  const rows = await getResourcesForCity(city, { essentialsOnly: true });
  const actionCandidates = rows.map((resource) => ({
    id: resource.id,
    title: resource.title,
    href: buildResourceHref(city, resource),
    stage: resource.lifecycleStage[0],
  }));

  const groups: Record<ResourceStage, ResolvedResource[]> = {
    PRE_ARRIVAL: [],
    FIRST_30_DAYS: [],
    FIRST_90_DAYS: [],
    SETTLED: [],
    ANYTIME: [],
  };
  const unscheduled: ResolvedResource[] = [];
  for (const r of rows) {
    if (r.lifecycleStage.length === 0) {
      unscheduled.push(r);
      continue;
    }
    for (const stage of r.lifecycleStage) {
      groups[stage].push(r);
    }
  }

  const populatedStages = STAGE_ORDER.filter((s) => groups[s].length > 0);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <nav className="text-muted mb-2 text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityName}
          </Link>
          {' / '}
          <Link
            href={`/${city}/resources`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            Resources
          </Link>
          {' / '}
          <span>Journey</span>
        </nav>
        <h1 className="text-2xl font-bold">Your Newcomer Journey in {cityName}</h1>
        <p className="text-muted mt-2 text-sm">
          The official steps Indian newcomers need to complete - grouped by when they matter.
        </p>
      </div>

      <JourneyNextBestAction
        city={city}
        cityName={cityName}
        candidates={actionCandidates}
        enabled={FLAGS.resourcesJourneyResumeEnabled}
      />

      {rows.length === 0 && (
        <div className="border-border rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted text-lg">No journey items yet</p>
          <p className="text-muted mt-1 text-sm">Browse the full resource library instead.</p>
          <Link
            href={`/${city}/resources`}
            className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
          >
            ← Back to Resources
          </Link>
        </div>
      )}

      {populatedStages.map((stage) => {
        const meta = STAGE_LABELS[stage];
        return (
          <section key={stage}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <h2 className="text-lg font-semibold">{meta.title}</h2>
                <p className="text-muted text-sm">{meta.blurb}</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {groups[stage].map((r) => (
                <ItemCard key={`${stage}-${r.slug}`} r={r} city={city} />
              ))}
            </ul>
          </section>
        );
      })}

      {unscheduled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Other Essentials</h2>
          <p className="text-muted text-sm">Important any time during your stay.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {unscheduled.map((r) => (
              <ItemCard key={`u-${r.slug}`} r={r} city={city} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
