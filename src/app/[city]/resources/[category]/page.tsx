import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ResourceType } from '@prisma/client';
import { db } from '@/lib/db';
import { RESOURCE_CATEGORIES, RESOURCE_SLUG_TO_TYPE } from '@/lib/config';

/**
 * Resource Category Page — all guides within one topic.
 *
 * Route: /[city]/resources/[category]/
 * Example: /stuttgart/resources/city-registration/
 * Example: /stuttgart/resources/tax-finance/
 */

type Props = { params: Promise<{ city: string; category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category } = await params;
  const cat = RESOURCE_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `${cat.title} — Indian Expat Guide for ${cityName}`,
    description: `${cat.description} Practical guides for Indians in ${cityName}, Germany.`,
  };
}

export default async function ResourceCategoryPage({ params }: Props) {
  const { city, category } = await params;

  const cat = RESOURCE_CATEGORIES.find((c) => c.slug === category);
  const resourceType = RESOURCE_SLUG_TO_TYPE[category];
  if (!cat || !resourceType) notFound();

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
      resourceType: resourceType as ResourceType,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: { title: 'asc' },
  });

  // Related categories (exclude current)
  const related = RESOURCE_CATEGORIES.filter((c) => c.slug !== category).slice(0, 3);

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
          <span>{cat.shortTitle}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${cat.color} text-lg shadow-sm`}
          >
            {cat.icon}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{cat.title}</h1>
            <p className="text-muted mt-0.5 text-sm">{cat.description}</p>
          </div>
        </div>
      </div>

      {resources.length === 0 && (
        <div className="border-border rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted text-lg">No guides in this category yet</p>
          <p className="text-muted mt-1 text-sm">Check back soon or browse other topics.</p>
          <Link
            href={`/${city}/resources`}
            className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
          >
            ← Back to Resources
          </Link>
        </div>
      )}

      {/* Guide cards */}
      {resources.length > 0 && (
        <div className="space-y-4">
          {resources.map((r) => (
            <article
              key={r.id}
              id={r.slug}
              className="scroll-mt-24 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.06] transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-foreground text-[15px] font-semibold">{r.title}</h2>
                  {r.description && (
                    <p className="text-muted mt-2 text-sm leading-relaxed">{r.description}</p>
                  )}
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cat.bgLight} ${cat.textColor} shrink-0 rounded-lg px-4 py-2 text-sm font-medium ring-1 ${cat.ringColor} transition-colors hover:opacity-80`}
                  >
                    Visit →
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Related categories */}
      <section>
        <h2 className="text-lg font-semibold">Related Topics</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {related.map((rc) => (
            <Link
              key={rc.slug}
              href={`/${city}/resources/${rc.slug}`}
              className="group flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${rc.color} text-base shadow-sm`}
              >
                {rc.icon}
              </span>
              <span className="text-foreground group-hover:text-brand-600 text-sm font-medium transition-colors">
                {rc.shortTitle}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-brand-100 bg-brand-50 rounded-xl border p-5">
        <h2 className="text-brand-900 font-semibold">
          Know a useful {cat.shortTitle.toLowerCase()} resource?
        </h2>
        <p className="text-brand-700 mt-1 text-sm">
          Help fellow Indians in {cityName} by suggesting a service or guide.
        </p>
        <Link href={`/${city}/suggest`} className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
          Suggest a resource →
        </Link>
      </section>
    </div>
  );
}
