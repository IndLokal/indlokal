import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

/**
 * Indian Expat Services & Practical Guides
 *
 * Route: /[city]/resources/
 * Example: /stuttgart/resources/
 *
 * Targets: "Indian grocery store Stuttgart", "Hindi speaking doctor Stuttgart",
 *          "Anmeldung guide Stuttgart", "Kindergeld for Indians"
 */

type Props = { params: Promise<{ city: string }> };

/** Category order for display */
const CATEGORY_ORDER = [
  'CITY_REGISTRATION',
  'DRIVING',
  'HOUSING',
  'HEALTH_DOCTORS',
  'JOBS_CAREERS',
  'TAX_FINANCE',
  'BUSINESS_SETUP',
  'FAMILY_CHILDREN',
  'GROCERY_FOOD',
  'COMMUNITY_RESOURCE',
] as const;

const TYPE_LABELS: Record<string, string> = {
  CITY_REGISTRATION: 'City Registration & Visa',
  DRIVING: 'Driving in Germany',
  HOUSING: 'Housing & Accommodation',
  HEALTH_DOCTORS: 'Health & Doctors',
  JOBS_CAREERS: 'Jobs & Careers',
  TAX_FINANCE: 'Tax & Finance',
  BUSINESS_SETUP: 'Starting a Business',
  FAMILY_CHILDREN: 'Family & Children',
  GROCERY_FOOD: 'Indian Grocery & Food',
  COMMUNITY_RESOURCE: 'Community Resources',
};

const TYPE_ICONS: Record<string, string> = {
  CITY_REGISTRATION: '🏛️',
  DRIVING: '🚗',
  HOUSING: '🏠',
  HEALTH_DOCTORS: '🏥',
  JOBS_CAREERS: '💼',
  TAX_FINANCE: '💰',
  BUSINESS_SETUP: '🏢',
  FAMILY_CHILDREN: '👶',
  GROCERY_FOOD: '🛒',
  COMMUNITY_RESOURCE: '🤝',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Expat Resources in ${cityName}`,
    description: `Practical guides for Indians in ${cityName} — city registration, driving licence, health insurance, taxes, Kindergeld, housing, grocery stores, and more.`,
  };
}

export default async function ResourcesPage({ params }: Props) {
  const { city } = await params;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true, id: true, satelliteCities: { select: { id: true } } },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityIds = [cityRow.id, ...cityRow.satelliteCities.map((s: { id: string }) => s.id)];
  const cityName = cityRow.name;

  const resources = await db.resource.findMany({
    where: {
      cityId: { in: cityIds },
      resourceType: {
        in: [
          'CITY_REGISTRATION',
          'DRIVING',
          'HOUSING',
          'HEALTH_DOCTORS',
          'JOBS_CAREERS',
          'TAX_FINANCE',
          'BUSINESS_SETUP',
          'FAMILY_CHILDREN',
          'GROCERY_FOOD',
          'COMMUNITY_RESOURCE',
        ],
      },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: [{ resourceType: 'asc' }, { title: 'asc' }],
  });

  // Group by type, ordered by CATEGORY_ORDER
  const grouped: Record<string, typeof resources> = {};
  for (const r of resources) {
    if (!grouped[r.resourceType]) grouped[r.resourceType] = [];
    grouped[r.resourceType].push(r);
  }
  const orderedTypes = CATEGORY_ORDER.filter((t) => grouped[t]?.length);

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
        <h1 className="text-3xl font-bold">Indian Expat Resources in {cityName}</h1>
        <p className="text-muted mt-2">
          Practical guides on city registration, driving, health insurance, taxes, Kindergeld,
          housing, Indian groceries, and more — everything an Indian expat needs in {cityName}.
        </p>
      </div>

      {resources.length === 0 && (
        <p className="text-muted">No resources listed yet — check back soon.</p>
      )}

      {/* Grouped sections */}
      {orderedTypes.map((type) => {
        const items = grouped[type];
        return (
          <section key={type}>
            <h2 className="text-xl font-semibold">
              {TYPE_ICONS[type]} {TYPE_LABELS[type] ?? type}
            </h2>
            <div className="mt-4 space-y-4">
              {items.map((r) => (
                <div key={r.id} className="card-base p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-foreground font-semibold">{r.title}</h3>
                      {r.description && (
                        <p className="text-muted mt-1 text-sm leading-relaxed">{r.description}</p>
                      )}
                    </div>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-brand-50 text-brand-700 hover:bg-brand-100 shrink-0 rounded-[var(--radius-button)] px-4 py-2 text-sm font-medium"
                      >
                        Visit →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="border-brand-100 bg-brand-50 rounded-[var(--radius-panel)] border p-5">
        <h2 className="text-brand-900 font-semibold">Know an Indian service in {cityName}?</h2>
        <p className="text-brand-700 mt-1 text-sm">
          Help fellow Indians discover useful services — grocery stores, doctors, tax consultants,
          and more.
        </p>
        <Link href={`/${city}/suggest`} className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
          Suggest a service →
        </Link>
      </section>

      {/* Link to consular services */}
      <p className="text-muted text-sm">
        Looking for passport, visa, or consular services?{' '}
        <Link href={`/${city}/consular-services`} className="text-brand-600 hover:underline">
          View consular services →
        </Link>
      </p>
    </div>
  );
}
