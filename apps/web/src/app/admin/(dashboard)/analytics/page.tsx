import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { db } from '@/lib/db';

const LENS_CONTEXT = 'business_careers';
const BUSINESS_LENS_ENTITY_ID = 'business_lens';
const LOOKBACK_DAYS = 30;

type CityMetrics = {
  cityId: string;
  cityName: string;
  citySlug: string;
  lensViews: number;
  emptyViews: number;
  eventViews: number;
  saves: number;
  registrationClicks: number;
};

type ResourceJourneyMetrics = {
  cityId: string;
  cityName: string;
  citySlug: string;
  journeyViews: number;
  stageViews: number;
  nextActionImpressions: number;
  nextActionClicks: number;
  resumeClicks: number;
  completions: number;
};

type ResourceHubMetrics = {
  cityId: string;
  cityName: string;
  citySlug: string;
  hubViews: number;
  personaSelections: number;
  intentSelections: number;
  essentialsClicks: number;
  ctaClicks: number;
};

function isMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hasBusinessLens(metadata: Prisma.JsonValue | null): boolean {
  return isMetadataObject(metadata).lens_context === LENS_CONTEXT;
}

function isEmptyLensView(metadata: Prisma.JsonValue | null): boolean {
  return isMetadataObject(metadata).result_count === 0;
}

function metadataString(metadata: Prisma.JsonValue | null, key: string): string | undefined {
  const value = isMetadataObject(metadata)[key];
  return typeof value === 'string' ? value : undefined;
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

async function getLookbackStart(): Promise<Date> {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

export default async function AdminAnalyticsPage() {
  const since = await getLookbackStart();

  const [cities, lensViews, recentEventInteractions, recentResourceInteractions] =
    await Promise.all([
      db.city.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
      db.userInteraction.findMany({
        where: {
          entityType: 'RESOURCE',
          entityId: BUSINESS_LENS_ENTITY_ID,
          interactionType: 'VIEW',
          createdAt: { gte: since },
        },
        select: { cityId: true, metadata: true },
      }),
      db.userInteraction.findMany({
        where: {
          entityType: 'EVENT',
          interactionType: { in: ['VIEW', 'SAVE', 'CLICK_ACCESS'] },
          createdAt: { gte: since },
        },
        select: { cityId: true, interactionType: true, metadata: true },
      }),
      db.userInteraction.findMany({
        where: {
          entityType: 'RESOURCE',
          interactionType: { in: ['VIEW', 'CLICK_ACCESS', 'SAVE'] },
          createdAt: { gte: since },
        },
        select: { cityId: true, entityId: true, interactionType: true, metadata: true },
      }),
    ]);

  const cityById = new Map(cities.map((city) => [city.id, city]));
  const metricsByCity = new Map<string, CityMetrics>();

  function rowFor(cityId: string | null): CityMetrics | null {
    if (!cityId) return null;
    const city = cityById.get(cityId);
    if (!city) return null;
    const existing = metricsByCity.get(cityId);
    if (existing) return existing;
    const next: CityMetrics = {
      cityId,
      cityName: city.name,
      citySlug: city.slug,
      lensViews: 0,
      emptyViews: 0,
      eventViews: 0,
      saves: 0,
      registrationClicks: 0,
    };
    metricsByCity.set(cityId, next);
    return next;
  }

  for (const interaction of lensViews) {
    const row = rowFor(interaction.cityId);
    if (!row) continue;
    row.lensViews += 1;
    if (isEmptyLensView(interaction.metadata)) row.emptyViews += 1;
  }

  const businessEventInteractions = recentEventInteractions.filter((interaction) =>
    hasBusinessLens(interaction.metadata),
  );

  for (const interaction of businessEventInteractions) {
    const row = rowFor(interaction.cityId);
    if (row) {
      if (interaction.interactionType === 'VIEW') row.eventViews += 1;
      if (interaction.interactionType === 'SAVE') row.saves += 1;
      if (interaction.interactionType === 'CLICK_ACCESS') row.registrationClicks += 1;
    }
  }

  const rows = [...metricsByCity.values()].sort((a, b) => b.lensViews - a.lensViews);
  const totals = rows.reduce(
    (acc, row) => ({
      lensViews: acc.lensViews + row.lensViews,
      emptyViews: acc.emptyViews + row.emptyViews,
      eventViews: acc.eventViews + row.eventViews,
      saves: acc.saves + row.saves,
      registrationClicks: acc.registrationClicks + row.registrationClicks,
    }),
    { lensViews: 0, emptyViews: 0, eventViews: 0, saves: 0, registrationClicks: 0 },
  );

  const resourceMetricsByCity = new Map<string, ResourceJourneyMetrics>();
  const hubMetricsByCity = new Map<string, ResourceHubMetrics>();

  function resourceRowFor(cityId: string | null): ResourceJourneyMetrics | null {
    if (!cityId) return null;
    const city = cityById.get(cityId);
    if (!city) return null;
    const existing = resourceMetricsByCity.get(cityId);
    if (existing) return existing;
    const next: ResourceJourneyMetrics = {
      cityId,
      cityName: city.name,
      citySlug: city.slug,
      journeyViews: 0,
      stageViews: 0,
      nextActionImpressions: 0,
      nextActionClicks: 0,
      resumeClicks: 0,
      completions: 0,
    };
    resourceMetricsByCity.set(cityId, next);
    return next;
  }

  function hubRowFor(cityId: string | null): ResourceHubMetrics | null {
    if (!cityId) return null;
    const city = cityById.get(cityId);
    if (!city) return null;
    const existing = hubMetricsByCity.get(cityId);
    if (existing) return existing;
    const next: ResourceHubMetrics = {
      cityId,
      cityName: city.name,
      citySlug: city.slug,
      hubViews: 0,
      personaSelections: 0,
      intentSelections: 0,
      essentialsClicks: 0,
      ctaClicks: 0,
    };
    hubMetricsByCity.set(cityId, next);
    return next;
  }

  for (const interaction of recentResourceInteractions) {
    const row = hubRowFor(interaction.cityId);
    if (!row) continue;

    const hubSignal = interaction.entityId.startsWith('resources_hub:');
    const sourceEvent = metadataString(interaction.metadata, 'source_event');
    const sourceSurface = metadataString(interaction.metadata, 'source_surface');

    if (!hubSignal) continue;

    if (interaction.interactionType === 'VIEW' && sourceSurface === 'resources_hub') {
      row.hubViews += 1;
    }
    if (interaction.interactionType === 'CLICK_ACCESS') {
      if (sourceEvent === 'resources_persona_selected') row.personaSelections += 1;
      if (sourceEvent === 'resources_intent_chip_selected') row.intentSelections += 1;
      if (sourceEvent === 'resources_essentials_click') row.essentialsClicks += 1;
      if (sourceEvent === 'resource_cta_click') row.ctaClicks += 1;
    }
  }

  for (const interaction of recentResourceInteractions) {
    const row = resourceRowFor(interaction.cityId);
    if (!row) continue;

    const sourceSurface = metadataString(interaction.metadata, 'source_surface');
    const entityIsJourney = interaction.entityId.startsWith('journey:');
    const entityDepth = interaction.entityId.split(':').length;

    if (interaction.interactionType === 'VIEW') {
      if (entityIsJourney && entityDepth === 2) row.journeyViews += 1;
      else if (entityIsJourney && entityDepth > 2) row.stageViews += 1;

      if (sourceSurface === 'resources_journey' || sourceSurface === 'resources_hub_resume') {
        row.nextActionImpressions += 1;
      }
    }

    if (interaction.interactionType === 'CLICK_ACCESS') {
      if (sourceSurface === 'resources_hub_resume') row.resumeClicks += 1;
      if (sourceSurface === 'resources_journey' || sourceSurface === 'resources_hub_resume') {
        row.nextActionClicks += 1;
      }
    }

    if (interaction.interactionType === 'SAVE' && sourceSurface === 'resources_journey') {
      row.completions += 1;
    }
  }

  const resourceRows = [...resourceMetricsByCity.values()].sort(
    (a, b) => b.journeyViews - a.journeyViews || b.stageViews - a.stageViews,
  );
  const resourceTotals = resourceRows.reduce(
    (acc, row) => ({
      journeyViews: acc.journeyViews + row.journeyViews,
      stageViews: acc.stageViews + row.stageViews,
      nextActionImpressions: acc.nextActionImpressions + row.nextActionImpressions,
      nextActionClicks: acc.nextActionClicks + row.nextActionClicks,
      resumeClicks: acc.resumeClicks + row.resumeClicks,
      completions: acc.completions + row.completions,
    }),
    {
      journeyViews: 0,
      stageViews: 0,
      nextActionImpressions: 0,
      nextActionClicks: 0,
      resumeClicks: 0,
      completions: 0,
    },
  );

  const hubRows = [...hubMetricsByCity.values()].sort(
    (a, b) => b.hubViews - a.hubViews || b.essentialsClicks - a.essentialsClicks,
  );
  const hubTotals = hubRows.reduce(
    (acc, row) => ({
      hubViews: acc.hubViews + row.hubViews,
      personaSelections: acc.personaSelections + row.personaSelections,
      intentSelections: acc.intentSelections + row.intentSelections,
      essentialsClicks: acc.essentialsClicks + row.essentialsClicks,
      ctaClicks: acc.ctaClicks + row.ctaClicks,
    }),
    {
      hubViews: 0,
      personaSelections: 0,
      intentSelections: 0,
      essentialsClicks: 0,
      ctaClicks: 0,
    },
  );

  return (
    <AdminPage>
      <AdminPageHeader
        title="Analytics"
        description={`Workspace-wide product signals. Business intent uses the last ${LOOKBACK_DAYS} days.`}
      />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Business intent</h2>
          <p className="text-muted text-sm">
            Business and Careers lens adoption and event conversion signals.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Lens views" value={totals.lensViews} />
          <Stat label="Empty views" value={`${pct(totals.emptyViews, totals.lensViews)}`} />
          <Stat label="Detail rate" value={pct(totals.eventViews, totals.lensViews)} />
          <Stat label="Saves" value={totals.saves} />
          <Stat label="Registration clicks" value={totals.registrationClicks} />
        </div>

        <div className="border-border mt-6 overflow-hidden rounded-[var(--radius-card)] border">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">City</th>
                <th className="px-3 py-2 text-right font-medium">Lens views</th>
                <th className="px-3 py-2 text-right font-medium">Empty</th>
                <th className="px-3 py-2 text-right font-medium">Detail rate</th>
                <th className="px-3 py-2 text-right font-medium">Saves</th>
                <th className="px-3 py-2 text-right font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.cityId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/${row.citySlug}/business-events`}
                        className="font-medium hover:underline"
                      >
                        {row.cityName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.lensViews}</td>
                    <td className="px-3 py-2 text-right">{pct(row.emptyViews, row.lensViews)}</td>
                    <td className="px-3 py-2 text-right">{pct(row.eventViews, row.lensViews)}</td>
                    <td className="px-3 py-2 text-right">{row.saves}</td>
                    <td className="px-3 py-2 text-right">{row.registrationClicks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-muted px-3 py-6 text-center" colSpan={6}>
                    No business-lens interactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Resources hub</h2>
          <p className="text-muted text-sm">
            Minimal persisted funnel signals for the hub surface. PostHog remains the primary
            analytics source; this mirrors only the dashboard-critical events.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Hub views" value={hubTotals.hubViews} />
          <Stat label="Persona selects" value={hubTotals.personaSelections} />
          <Stat label="Intent selects" value={hubTotals.intentSelections} />
          <Stat label="Essentials clicks" value={hubTotals.essentialsClicks} />
          <Stat label="CTA clicks" value={hubTotals.ctaClicks} />
        </div>

        <div className="border-border mt-6 overflow-hidden rounded-[var(--radius-card)] border">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">City</th>
                <th className="px-3 py-2 text-right font-medium">Views</th>
                <th className="px-3 py-2 text-right font-medium">Persona</th>
                <th className="px-3 py-2 text-right font-medium">Intent</th>
                <th className="px-3 py-2 text-right font-medium">Essentials</th>
                <th className="px-3 py-2 text-right font-medium">CTA</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {hubRows.length ? (
                hubRows.map((row) => (
                  <tr key={row.cityId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/${row.citySlug}/resources`}
                        className="font-medium hover:underline"
                      >
                        {row.cityName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.hubViews}</td>
                    <td className="px-3 py-2 text-right">{row.personaSelections}</td>
                    <td className="px-3 py-2 text-right">{row.intentSelections}</td>
                    <td className="px-3 py-2 text-right">{row.essentialsClicks}</td>
                    <td className="px-3 py-2 text-right">{row.ctaClicks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-muted px-3 py-6 text-center" colSpan={6}>
                    No persisted resources hub interactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Resources journey</h2>
          <p className="text-muted text-sm">
            Live persisted signals from the resources journey flow: view, stage, next-action,
            resume, and completion events.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Journey views" value={resourceTotals.journeyViews} />
          <Stat label="Stage views" value={resourceTotals.stageViews} />
          <Stat label="Next-action impressions" value={resourceTotals.nextActionImpressions} />
          <Stat label="Next-action clicks" value={resourceTotals.nextActionClicks} />
          <Stat label="Resume clicks" value={resourceTotals.resumeClicks} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Completions" value={resourceTotals.completions} />
          <Stat
            label="Click-through"
            value={`${pct(resourceTotals.nextActionClicks, resourceTotals.nextActionImpressions)}`}
          />
          <Stat
            label="Resume share"
            value={`${pct(resourceTotals.resumeClicks, resourceTotals.nextActionClicks || 1)}`}
          />
          <Stat
            label="Completion share"
            value={`${pct(resourceTotals.completions, resourceTotals.nextActionClicks || 1)}`}
          />
          <Stat
            label="Stage depth share"
            value={`${pct(resourceTotals.stageViews, resourceTotals.journeyViews || 1)}`}
          />
        </div>

        <div className="border-border mt-6 overflow-hidden rounded-[var(--radius-card)] border">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">City</th>
                <th className="px-3 py-2 text-right font-medium">Journey</th>
                <th className="px-3 py-2 text-right font-medium">Stages</th>
                <th className="px-3 py-2 text-right font-medium">Next-action</th>
                <th className="px-3 py-2 text-right font-medium">Resume</th>
                <th className="px-3 py-2 text-right font-medium">Complete</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {resourceRows.length ? (
                resourceRows.map((row) => (
                  <tr key={row.cityId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/${row.citySlug}/resources`}
                        className="font-medium hover:underline"
                      >
                        {row.cityName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.journeyViews}</td>
                    <td className="px-3 py-2 text-right">{row.stageViews}</td>
                    <td className="px-3 py-2 text-right">{row.nextActionClicks}</td>
                    <td className="px-3 py-2 text-right">{row.resumeClicks}</td>
                    <td className="px-3 py-2 text-right">{row.completions}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-muted px-3 py-6 text-center" colSpan={6}>
                    No persisted resource journey interactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-border rounded-[var(--radius-card)] border bg-white p-4">
      <p className="text-muted text-xs font-medium uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
