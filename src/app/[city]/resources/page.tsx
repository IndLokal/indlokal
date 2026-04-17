import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { RESOURCE_CATEGORIES } from '@/lib/config';

/**
 * Resources Hub — category card grid linking to sub-pages.
 *
 * Route: /[city]/resources/
 * Example: /stuttgart/resources/
 *
 * Each category card links to /[city]/resources/[category]/.
 */

type Props = { params: Promise<{ city: string }> };

/** Top guides shown as quick-access links */
const POPULAR_GUIDES = [
  { slug: 'guide-anmeldung-stuttgart', label: 'Anmeldung Guide', icon: '📋' },
  { slug: 'guide-eu-blue-card', label: 'EU Blue Card', icon: '💳' },
  { slug: 'guide-kindergeld-non-eu', label: 'Kindergeld', icon: '👶' },
  { slug: 'guide-health-insurance-gkv-pkv', label: 'Health Insurance', icon: '🏥' },
  { slug: 'guide-steuererklaerung-basics', label: 'Tax Return', icon: '💰' },
  { slug: 'guide-apartment-search-stuttgart', label: 'Apartment Search', icon: '🏠' },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Expat Resources in ${cityName}`,
    description: `Practical guides for Indians in ${cityName} — city registration, driving licence, health insurance, taxes, Kindergeld, housing, grocery stores, and more.`,
  };
}

export default async function ResourcesHubPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true, id: true, satelliteCities: { select: { id: true } } },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityIds = [cityRow.id, ...cityRow.satelliteCities.map((s: { id: string }) => s.id)];
  const cityName = cityRow.name;

  // Count resources per type for badge numbers
  const counts = await db.resource.groupBy({
    by: ['resourceType'],
    where: {
      cityId: { in: cityIds },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) {
    countMap[c.resourceType] = c._count;
  }

  // Check which popular guides actually exist
  const popularResources = await db.resource.findMany({
    where: {
      slug: { in: POPULAR_GUIDES.map((g) => g.slug) },
      cityId: { in: cityIds },
    },
    select: { slug: true, resourceType: true },
  });
  const existingSlugs = new Set(popularResources.map((r) => r.slug));

  // Consular count (separate page)
  const consularCount = await db.resource.count({
    where: {
      cityId: { in: cityIds },
      resourceType: {
        in: ['CONSULAR_SERVICE', 'OFFICIAL_EVENT', 'GOVERNMENT_INFO', 'VISA_SERVICE'],
      },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
  });

  const totalGuides = Object.values(countMap).reduce((a, b) => a + b, 0) + consularCount;

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
          <span>Resources</span>
        </nav>
        <h1 className="text-2xl font-bold">Indian Expat Resources in {cityName}</h1>
        <p className="text-muted mt-2 text-sm">
          {totalGuides} practical guides on everything an Indian expat needs in {cityName} — from
          Anmeldung to Kindergeld.
        </p>
      </div>

      {/* Popular guides — quick access */}
      {POPULAR_GUIDES.some((g) => existingSlugs.has(g.slug)) && (
        <section>
          <h2 className="text-lg font-semibold">Popular Guides</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_GUIDES.filter((g) => existingSlugs.has(g.slug)).map((guide) => {
              const resource = popularResources.find((r) => r.slug === guide.slug);
              const cat = resource
                ? RESOURCE_CATEGORIES.find((c) => c.type === resource.resourceType)
                : null;
              const categorySlug = cat?.slug ?? 'city-registration';
              return (
                <Link
                  key={guide.slug}
                  href={`/${city}/resources/${categorySlug}#${guide.slug}`}
                  className="group hover:ring-brand-200 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span>{guide.icon}</span>
                  <span className="text-foreground group-hover:text-brand-600 font-medium transition-colors">
                    {guide.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Category grid */}
      <section>
        <h2 className="text-lg font-semibold">Browse by Topic</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_CATEGORIES.map((cat) => {
            const count = countMap[cat.type] ?? 0;
            return (
              <Link
                key={cat.slug}
                href={`/${city}/resources/${cat.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-5 ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${cat.color} opacity-70`}
                />
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${cat.color} text-lg shadow-sm`}
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-foreground group-hover:text-brand-600 text-[15px] font-semibold transition-colors">
                      {cat.shortTitle}
                    </h3>
                    {count > 0 && (
                      <span className="text-muted text-xs">
                        {count} guide{count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-muted mt-3 text-[13px] leading-relaxed">{cat.description}</p>
              </Link>
            );
          })}

          {/* Consular services — links to existing page */}
          <Link
            href={`/${city}/consular-services`}
            className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-5 ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-400 to-rose-500 opacity-70" />
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-rose-500 text-lg shadow-sm">
                🇮🇳
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground group-hover:text-brand-600 text-[15px] font-semibold transition-colors">
                  Consular Services
                </h3>
                {consularCount > 0 && (
                  <span className="text-muted text-xs">
                    {consularCount} resource{consularCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <p className="text-muted mt-3 text-[13px] leading-relaxed">
              CGI consular camps, passport renewal, VFS appointments, and OCI services.
            </p>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-brand-100 bg-brand-50 rounded-xl border p-5">
        <h2 className="text-brand-900 font-semibold">Know an Indian service in {cityName}?</h2>
        <p className="text-brand-700 mt-1 text-sm">
          Help fellow Indians discover useful services — grocery stores, doctors, tax consultants,
          and more.
        </p>
        <Link href={`/${city}/suggest`} className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
          Suggest a service →
        </Link>
      </section>
    </div>
  );
}
