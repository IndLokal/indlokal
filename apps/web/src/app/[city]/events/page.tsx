import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { discovery as d } from '@indlokal/shared';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { countUpcomingEvents, getUpcomingEvents } from '@/modules/event';
import { db } from '@/lib/db';
import { EventCard } from '@/components/EventCard';
import { BusinessLensTracker } from '@/components/analytics';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageCrossLinks } from '@/components/city/CitySubpageCrossLinks';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';

/**
 * Event Listing - all upcoming events in a city.
 * Supports filters: category, cost, type.
 *
 * Route: /[city]/events/
 * Example: /stuttgart/events/
 * Example: /stuttgart/events/?category=cultural&cost=free
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{
    category?: string;
    cost?: string;
    type?: string;
    lens?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const filters = await searchParams;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  const title = `Indian Events in ${cityName}`;
  const description = `Upcoming Indian community events, festivals, and gatherings in ${cityName}, Germany.`;

  const hasFilters = Boolean(filters.category || filters.cost || filters.type);

  if (filters.lens === 'business') {
    return {
      title: `Business Events in ${cityName}`,
      description: `Business networking and careers events for Indians in ${cityName}, Germany.`,
      alternates: {
        canonical: `/${city}/business-events`,
      },
      robots: { index: false, follow: true },
    };
  }

  if (hasFilters) {
    return {
      title,
      description,
      alternates: {
        canonical: `/${city}/events`,
      },
      robots: { index: false, follow: true },
    };
  }

  return {
    title,
    description,
    alternates: {
      canonical: `/${city}/events`,
    },
    openGraph: {
      title,
      description,
      url: `/${city}/events`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { city } = await params;
  const filters = await searchParams;
  const pagination = parseOffsetPagination(filters, { defaultPageSize: 16, maxPageSize: 48 });
  const cost = filters.cost === 'free' || filters.cost === 'paid' ? filters.cost : undefined;
  const type = filters.type === 'online' || filters.type === 'in-person' ? filters.type : undefined;
  const lens = filters.lens === 'business' ? 'business' : undefined;

  const baseCostTypeParams = new URLSearchParams();
  if (cost) baseCostTypeParams.set('cost', cost);
  if (type) baseCostTypeParams.set('type', type);
  const allLensHref = baseCostTypeParams.toString()
    ? `/${city}/events?${baseCostTypeParams.toString()}`
    : `/${city}/events`;
  const businessLensParams = new URLSearchParams(baseCostTypeParams);
  businessLensParams.set('lens', 'business');
  const businessLensHref = `/${city}/events?${businessLensParams.toString()}`;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const [totalEventCount, events, categories] = await Promise.all([
    countUpcomingEvents(city, {
      categorySlug: lens === 'business' ? undefined : filters.category,
      categorySlugs: lens === 'business' ? [...d.BUSINESS_EVENT_CATEGORY_SLUGS] : undefined,
      cost,
      type,
    }),
    getUpcomingEvents(city, {
      categorySlug: lens === 'business' ? undefined : filters.category,
      categorySlugs: lens === 'business' ? [...d.BUSINESS_EVENT_CATEGORY_SLUGS] : undefined,
      cost,
      type,
      limit: pagination.take,
      offset: pagination.skip,
    }),
    db.category.findMany({
      where: { type: 'CATEGORY' },
      select: { name: true, slug: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  const cityName = cityRow.name;
  type CategoryItem = (typeof categories)[number];
  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount: totalEventCount,
    itemCount: events.length,
  });

  const description =
    totalEventCount > 0
      ? `${totalEventCount} upcoming Indian event${totalEventCount !== 1 ? 's' : ''} in ${cityName}, Germany.`
      : `No upcoming Indian events right now in ${cityName}, Germany - check back soon.`;

  const activeCategoryName = filters.category
    ? (categories.find((cat: CategoryItem) => cat.slug === filters.category)?.name ??
      filters.category)
    : null;
  const activeCostLabel = cost ? (cost === 'free' ? 'Free' : 'Paid') : null;
  const activeTypeLabel = type ? (type === 'in-person' ? 'In-person' : 'Online') : null;

  const activeFilterSummary = [
    activeCategoryName ? `Category: ${activeCategoryName}` : null,
    activeCostLabel ? `Cost: ${activeCostLabel}` : null,
    activeTypeLabel ? `Format: ${activeTypeLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-8">
      {lens === 'business' && (
        <BusinessLensTracker city={city} surface="events_page" resultCount={totalEventCount} />
      )}

      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel={lens === 'business' ? 'Business events' : 'Events'}
        title={
          lens === 'business' ? `Business Events in ${cityName}` : `Indian Events in ${cityName}`
        }
        description={description}
      />

      {/* Mobile filters: lens first, advanced filters in expandable panel */}
      <div className="space-y-2 sm:hidden">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link
            href={allLensHref}
            className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
              lens !== 'business'
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-border text-muted hover:border-border hover:text-foreground'
            }`}
          >
            All events
          </Link>
          <Link
            href={businessLensHref}
            className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
              lens === 'business'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-border text-muted hover:border-border hover:text-foreground'
            }`}
          >
            💼 Business & Careers
          </Link>
        </div>

        <details className="border-border rounded-[var(--radius-button)] border bg-white p-3">
          <summary className="text-muted cursor-pointer list-none text-sm font-medium marker:hidden">
            {activeFilterSummary ? `Filters: ${activeFilterSummary}` : 'More filters'}
          </summary>

          <div className="mt-3 space-y-3">
            {lens !== 'business' && (
              <div className="space-y-2">
                <p className="text-muted text-xs font-semibold tracking-wide uppercase">Category</p>
                <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {(() => {
                    const allCategoryParams = new URLSearchParams();
                    if (lens === 'business') allCategoryParams.set('lens', 'business');
                    if (cost) allCategoryParams.set('cost', cost);
                    if (type) allCategoryParams.set('type', type);
                    const allCategoryHref = allCategoryParams.toString()
                      ? `/${city}/events?${allCategoryParams.toString()}`
                      : `/${city}/events`;
                    return (
                      <Link
                        href={allCategoryHref}
                        className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                          !filters.category
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-border text-muted hover:border-border hover:text-foreground'
                        }`}
                      >
                        All
                      </Link>
                    );
                  })()}
                  {categories.map((cat: CategoryItem) => {
                    const isActive = filters.category === cat.slug;
                    const categoryParams = new URLSearchParams();
                    categoryParams.set('category', cat.slug);
                    if (cost) categoryParams.set('cost', cost);
                    if (type) categoryParams.set('type', type);
                    const href = `/${city}/events?${categoryParams.toString()}`;
                    return (
                      <Link
                        key={cat.slug}
                        href={href}
                        className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                          isActive
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-border text-muted hover:border-border hover:text-foreground'
                        }`}
                      >
                        {cat.icon} {cat.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Cost</p>
              <div className="flex flex-wrap gap-2">
                {(['free', 'paid'] as const).map((costOption) => {
                  const isActive = costOption === filters.cost;
                  const params = new URLSearchParams();
                  if (lens === 'business') params.set('lens', 'business');
                  if (lens !== 'business' && filters.category)
                    params.set('category', filters.category);
                  if (!isActive) params.set('cost', costOption);
                  if (type) params.set('type', type);
                  const href = params.toString()
                    ? `/${city}/events?${params.toString()}`
                    : `/${city}/events`;
                  return (
                    <Link
                      key={costOption}
                      href={href}
                      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium capitalize transition-colors active:opacity-70 ${
                        isActive
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-border text-muted hover:border-border hover:text-foreground'
                      }`}
                    >
                      {costOption}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Format</p>
              <div className="flex flex-wrap gap-2">
                {(['in-person', 'online'] as const).map((typeOption) => {
                  const isActive = typeOption === filters.type;
                  const params = new URLSearchParams();
                  if (lens === 'business') params.set('lens', 'business');
                  if (lens !== 'business' && filters.category)
                    params.set('category', filters.category);
                  if (cost) params.set('cost', cost);
                  if (!isActive) params.set('type', typeOption);
                  const href = params.toString()
                    ? `/${city}/events?${params.toString()}`
                    : `/${city}/events`;
                  return (
                    <Link
                      key={typeOption}
                      href={href}
                      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                        isActive
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-border text-muted hover:border-border hover:text-foreground'
                      }`}
                    >
                      {typeOption === 'in-person' ? '📍 In-person' : '🌐 Online'}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Desktop filters */}
      <div className="hidden flex-wrap gap-2 sm:flex">
        {/* Lens filter */}
        <>
          <Link
            href={allLensHref}
            className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
              lens !== 'business'
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-border text-muted hover:border-border hover:text-foreground'
            }`}
          >
            All events
          </Link>
          <Link
            href={businessLensHref}
            className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
              lens === 'business'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-border text-muted hover:border-border hover:text-foreground'
            }`}
          >
            💼 Business & Careers
          </Link>
          <span className="text-border hidden self-center sm:inline">|</span>
        </>

        {/* Category filter (not shown in business lens because category is ignored there) */}
        {lens !== 'business' && (
          <>
            {(() => {
              const allCategoryParams = new URLSearchParams();
              if (lens === 'business') allCategoryParams.set('lens', 'business');
              if (cost) allCategoryParams.set('cost', cost);
              if (type) allCategoryParams.set('type', type);
              const allCategoryHref = allCategoryParams.toString()
                ? `/${city}/events?${allCategoryParams.toString()}`
                : `/${city}/events`;
              return (
                <Link
                  href={allCategoryHref}
                  className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
                    !filters.category
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-border text-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  All
                </Link>
              );
            })()}
            {categories.map((cat: CategoryItem) => {
              const isActive = filters.category === cat.slug;
              const categoryParams = new URLSearchParams();
              categoryParams.set('category', cat.slug);
              if (cost) categoryParams.set('cost', cost);
              if (type) categoryParams.set('type', type);
              const href = `/${city}/events?${categoryParams.toString()}`;
              return (
                <Link
                  key={cat.slug}
                  href={href}
                  className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
                    isActive
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-border text-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  {cat.icon} {cat.name}
                </Link>
              );
            })}

            {/* Divider */}
            <span className="text-border hidden self-center sm:inline">|</span>
          </>
        )}

        {/* Cost filter */}
        {(['free', 'paid'] as const).map((cost) => {
          const isActive = cost === filters.cost;
          const params = new URLSearchParams();
          if (lens === 'business') params.set('lens', 'business');
          if (lens !== 'business' && filters.category) params.set('category', filters.category);
          if (!isActive) params.set('cost', cost);
          if (type) params.set('type', type);
          const href = params.toString()
            ? `/${city}/events?${params.toString()}`
            : `/${city}/events`;
          return (
            <Link
              key={cost}
              href={href}
              className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium capitalize transition-colors active:opacity-70 ${
                isActive
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-border text-muted hover:border-border hover:text-foreground'
              }`}
            >
              {cost}
            </Link>
          );
        })}

        {/* Type filter */}
        {(['in-person', 'online'] as const).map((type) => {
          const isActive = type === filters.type;
          const params = new URLSearchParams();
          if (lens === 'business') params.set('lens', 'business');
          if (lens !== 'business' && filters.category) params.set('category', filters.category);
          if (cost) params.set('cost', cost);
          if (!isActive) params.set('type', type);
          const href = params.toString()
            ? `/${city}/events?${params.toString()}`
            : `/${city}/events`;
          return (
            <Link
              key={type}
              href={href}
              className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
                isActive
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-border text-muted hover:border-border hover:text-foreground'
              }`}
            >
              {type === 'in-person' ? '📍 In-person' : '🌐 Online'}
            </Link>
          );
        })}
      </div>

      {/* Event grid */}
      {events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              city={city}
              lens={lens === 'business' ? 'business' : undefined}
            />
          ))}
        </div>
      )}
      {totalEventCount > 0 && (
        <PaginationControls
          meta={paginationMeta}
          getPageHref={(page) => buildPageHref({ searchParams: filters, page })}
        />
      )}

      {!filters.category && !filters.cost && !filters.type && lens !== 'business' && (
        <CitySeoTemplateSection city={city} cityName={cityName} topic="events" />
      )}

      <CitySubpageCrossLinks
        links={[
          { href: `/${city}/communities`, label: 'Browse communities →' },
          { href: `/${city}/search`, label: 'Search everything →' },
        ]}
      />
    </div>
  );
}
