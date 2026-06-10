import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { RESOURCE_CATEGORIES, RESOURCE_SLUG_TO_TYPE } from '@/lib/config';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { EventSaveButton } from '@/components/EventSaveButton';
import { ResourceSaveButton } from '@/components/ResourceSaveButton';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { getResourcesForCity } from '@/modules/resources';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { getUpcomingEvents } from '@/modules/event/queries';
import { getSessionUser } from '@/lib/session';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';
import { ResourcesTrackedLink } from '../ResourcesHubTracking';

/**
 * Resource Category Page - all guides within one topic.
 *
 * Route: /[city]/resources/[category]/
 * Example: /stuttgart/resources/city-registration/
 * Example: /stuttgart/resources/tax-finance/
 */

type Props = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};
type ResolverType = NonNullable<Parameters<typeof getResourcesForCity>[1]>['type'];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category } = await params;
  const cat = RESOURCE_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `${cat.title} - Indian Expat Guide for ${cityName}`,
    description: `${cat.description} Practical guides for Indians in ${cityName}, Germany.`,
    alternates: {
      canonical: `/${city}/resources/${category}`,
    },
  };
}

export default async function ResourceCategoryPage({ params, searchParams }: Props) {
  const { city, category } = await params;
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp, { defaultPageSize: 20, maxPageSize: 40 });

  const cat = RESOURCE_CATEGORIES.find((c) => c.slug === category);
  const resourceType = RESOURCE_SLUG_TO_TYPE[category];
  if (!cat || !resourceType) notFound();

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityName = cityRow.name;
  const user = await getSessionUser();
  const savedEventIds = new Set(user?.savedEvents.map((row) => row.eventId) ?? []);
  const savedResourceIds = new Set(user?.savedResources.map((row) => row.resourceId) ?? []);

  // Resolver returns CITY + METRO + STATE + COUNTRY rows for this category.
  const resources = await getResourcesForCity(city, {
    type: resourceType as ResolverType,
  });
  const [relatedCommunities, relatedEvents] = await Promise.all([
    getCommunitiesByCity(city, { categorySlug: category, limit: 3 }),
    getUpcomingEvents(city, { categorySlug: category, limit: 3 }),
  ]);
  resources.sort((a, b) => a.title.localeCompare(b.title));
  const pagedResources = resources.slice(pagination.skip, pagination.skip + pagination.take);
  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount: resources.length,
    itemCount: pagedResources.length,
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
          {pagedResources.map((r) => (
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
                <div className="shrink-0 space-y-2 text-right">
                  <div className="flex justify-end">
                    <ResourceSaveButton
                      resourceId={r.id}
                      resourceTitle={r.title}
                      saved={savedResourceIds.has(r.id)}
                      citySlug={city}
                      sourceSurface="resources_category"
                    />
                  </div>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${cat.bgLight} ${cat.textColor} inline-flex rounded-lg px-4 py-2 text-sm font-medium ring-1 ${cat.ringColor} transition-colors hover:opacity-80`}
                    >
                      Visit →
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
          <PaginationControls
            meta={paginationMeta}
            getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
          />
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

      {(relatedCommunities.length > 0 || relatedEvents.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold">Related communities and upcoming events</h2>
          <p className="text-muted mt-1 text-sm">
            Move from reading to participation with groups and events tied to this topic.
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {relatedCommunities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
                  Communities
                </h3>
                <div className="mt-3 space-y-3">
                  {relatedCommunities.map((community) => (
                    <ResourcesTrackedLink
                      key={community.id}
                      href={`/${city}/communities/${community.slug}`}
                      event="resources_to_related_click"
                      properties={{
                        city,
                        target_type: 'community',
                        target_id: community.id,
                        category,
                      }}
                      persistEntityType="COMMUNITY"
                      persistEntityId={community.id}
                      className="group flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground group-hover:text-brand-600 text-sm font-semibold transition-colors">
                            {community.name}
                          </span>
                          {community._count.events > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                              {community._count.events} upcoming
                            </span>
                          )}
                        </div>
                        {community.description && (
                          <p className="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">
                            {community.description}
                          </p>
                        )}
                      </div>
                    </ResourcesTrackedLink>
                  ))}
                </div>
              </div>
            )}

            {relatedEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
                  Upcoming events
                </h3>
                <div className="mt-3 space-y-3">
                  {relatedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <ResourcesTrackedLink
                        href={`/${city}/events/${event.slug}`}
                        event="resources_to_related_click"
                        properties={{
                          city,
                          target_type: 'event',
                          target_id: event.id,
                          category,
                        }}
                        persistEntityType="EVENT"
                        persistEntityId={event.id}
                        className="group block"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground group-hover:text-brand-600 text-sm font-semibold transition-colors">
                              {event.title}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                              {event.startsAt.toLocaleDateString('en-DE', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                          <p className="text-muted mt-1 text-sm leading-relaxed">
                            {event.community ? `${event.community.name} · ` : ''}
                            {event.isOnline ? 'Online' : (event.venueName ?? cityName)}
                          </p>
                        </div>
                      </ResourcesTrackedLink>
                      <div className="mt-3">
                        <EventSaveButton
                          eventId={event.id}
                          saved={savedEventIds.has(event.id)}
                          city={city}
                        />
                        <p className="text-muted mt-2 text-xs">
                          Save this event to keep it handy and receive an in-app reminder before it
                          starts.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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

      <CitySeoTemplateSection
        city={city}
        cityName={cityName}
        topic="resource-category"
        categoryTitle={cat.shortTitle}
      />
    </div>
  );
}
