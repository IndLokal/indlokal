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

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

async function getLookbackStart(): Promise<Date> {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

export default async function AdminAnalyticsPage() {
  const since = await getLookbackStart();

  const [cities, lensViews, recentEventInteractions] = await Promise.all([
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
