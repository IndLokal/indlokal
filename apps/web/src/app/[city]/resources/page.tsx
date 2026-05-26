import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { RESOURCE_CATEGORIES } from '@/lib/config';
import { getResourcesForCity } from '@/modules/resources';

/**
 * Resources Hub — category card grid + journey checklist.
 *
 * Route: /[city]/resources/
 * Example: /stuttgart/resources/
 *
 * Now driven by the resolver (PRD/TDD-0030), so counts include CITY +
 * METRO + STATE + COUNTRY rows (with consulate filtering) — satellite
 * cities like Karlsruhe inherit Stuttgart's metro rows automatically.
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

const CONSULAR_TYPES = ['CONSULAR_SERVICE', 'OFFICIAL_EVENT', 'GOVERNMENT_INFO', 'VISA_SERVICE'];

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
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityName = cityRow.name;

  // Single resolver call → full resource set (CITY+METRO+STATE+COUNTRY).
  const resources = await getResourcesForCity(city);

  // Count by resourceType.
  const countMap: Record<string, number> = {};
  for (const r of resources) {
    countMap[r.resourceType] = (countMap[r.resourceType] ?? 0) + 1;
  }

  const consularCount = resources.filter((r) => CONSULAR_TYPES.includes(r.resourceType)).length;
  const popularBySlug = new Map(
    resources.filter((r) => POPULAR_GUIDES.some((g) => g.slug === r.slug)).map((r) => [r.slug, r]),
  );

  const essentials = resources.filter((r) => r.isEssential);
  const essentialsCount = essentials.length;

  const totalGuides = resources.length;

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

      {/* Newcomer Journey — first 30 days checklist */}
      {essentialsCount > 0 && (
        <section className="border-brand-100 bg-brand-50/60 rounded-2xl border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-brand-900 text-lg font-semibold">
                New to {cityName}? Start here
              </h2>
              <p className="text-brand-700 mt-1 text-sm">
                {essentialsCount} essential step{essentialsCount === 1 ? '' : 's'} for your first
                30 days — the official ones every Indian newcomer needs.
              </p>
            </div>
            <Link
              href={`/${city}/resources/journey`}
              className="btn-primary shrink-0 px-4 py-2 text-sm"
            >
              Open checklist →
            </Link>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {essentials.slice(0, 6).map((r) => {
              const cat = RESOURCE_CATEGORIES.find((c) => c.type === r.resourceType);
              const categorySlug = cat?.slug ?? 'city-registration';
              return (
                <li key={r.slug}>
                  <Link
                    href={`/${city}/resources/${categorySlug}#${r.slug}`}
                    className="hover:ring-brand-200 group flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${cat?.color ?? 'from-slate-400 to-slate-500'} text-sm shadow-sm`}
                    >
                      {cat?.icon ?? '✓'}
                    </span>
                    <span className="text-foreground group-hover:text-brand-600 truncate text-sm font-medium transition-colors">
                      {r.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Popular guides — quick access */}
      {POPULAR_GUIDES.some((g) => popularBySlug.has(g.slug)) && (
        <section>
          <h2 className="text-lg font-semibold">Popular Guides</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_GUIDES.filter((g) => popularBySlug.has(g.slug)).map((guide) => {
              const resource = popularBySlug.get(guide.slug)!;
              const cat = RESOURCE_CATEGORIES.find((c) => c.type === resource.resourceType);
              const categorySlug = cat?.slug ?? 'city-registration';
              return (
                <Link
                  key={guide.slug}
                  href={`/${city}/resources/${categorySlug}#${guide.slug}`}
                  className="hover:ring-brand-200 group inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
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
