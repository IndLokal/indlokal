import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { db } from '@/lib/db';

/**
 * Programmatic SEO: Consular Services
 *
 * Route: /[city]/consular-services/
 * Example: /stuttgart/consular-services/
 *
 * Targets: "Indian consulate Stuttgart", "Indian passport Stuttgart"
 */

type Props = { params: Promise<{ city: string }> };

const TYPE_LABELS: Record<string, string> = {
  CONSULAR_SERVICE: 'Consular Service',
  OFFICIAL_EVENT: 'Official Event',
  GOVERNMENT_INFO: 'Government Info',
  VISA_SERVICE: 'Visa Service',
};

const TYPE_ICONS: Record<string, string> = {
  CONSULAR_SERVICE: '🏛️',
  OFFICIAL_EVENT: '📅',
  GOVERNMENT_INFO: 'ℹ️',
  VISA_SERVICE: '🛂',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Consular Services near ${cityName}`,
    description: `CGI consular camps, passport seva, VFS services, and official Indian government services near ${cityName}, Germany.`,
  };
}

export default async function ConsularServicesPage({ params }: Props) {
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
        in: ['CONSULAR_SERVICE', 'OFFICIAL_EVENT', 'GOVERNMENT_INFO', 'VISA_SERVICE'],
      },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: [{ resourceType: 'asc' }, { title: 'asc' }],
  });

  // Group by type
  const grouped: Record<string, typeof resources> = {};
  for (const r of resources) {
    if (!grouped[r.resourceType]) grouped[r.resourceType] = [];
    grouped[r.resourceType].push(r);
  }

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
          <span>Consular Services</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Consular Services near {cityName}</h1>
        <p className="text-muted mt-2">
          Passport seva, CGI consular camps, VFS appointments, and official services for Indians in{' '}
          {cityName}.
        </p>
      </div>

      {resources.length === 0 && (
        <p className="text-muted">No resources listed yet — check back soon.</p>
      )}

      {/* Grouped sections */}
      {Object.entries(grouped).map(([type, items]) => (
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
                    {(r.validFrom || r.validUntil) && (
                      <p className="text-muted mt-2 text-xs">
                        {r.validFrom && `From ${format(new Date(r.validFrom), 'MMM d, yyyy')}`}
                        {r.validFrom && r.validUntil && ' · '}
                        {r.validUntil && `Until ${format(new Date(r.validUntil), 'MMM d, yyyy')}`}
                      </p>
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
      ))}

      {/* Permanent info block */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">🏛️ Consulate General of India, Munich</h2>
        <p className="mt-1 text-sm text-amber-800">
          The nearest Indian Consulate for Stuttgart residents is in Munich. They conduct periodic
          Consular Camps in Stuttgart for passport, OCI, and document services.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://www.cgimunich.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100"
          >
            CGI Munich Website →
          </a>
          <a
            href="https://passportindia.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100"
          >
            Passport Seva Portal →
          </a>
          <a
            href="https://www.vfsglobal.com/India/Germany"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100"
          >
            VFS Global Germany →
          </a>
        </div>
      </section>
    </div>
  );
}
