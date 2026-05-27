import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { discovery as d } from '@indlokal/shared';
import { getUpcomingEvents } from '@/modules/event';
import { db } from '@/lib/db';
import { EventCard } from '@/components/EventCard';
import { BusinessLensTracker } from '@/components/analytics';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageCrossLinks } from '@/components/city/CitySubpageCrossLinks';

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
  searchParams: Promise<{ category?: string; cost?: string; type?: string; lens?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Events in ${cityName}`,
    description: `Upcoming Indian community events, festivals, and gatherings in ${cityName}, Germany.`,
  };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { city } = await params;
  const filters = await searchParams;
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

  const events = await getUpcomingEvents(city, {
    categorySlug: lens === 'business' ? undefined : filters.category,
    categorySlugs: lens === 'business' ? [...d.BUSINESS_EVENT_CATEGORY_SLUGS] : undefined,
    cost,
    type,
    limit: 16,
  });

  const cityName = cityRow.name;

  // Fetch categories for filter bar
  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { name: true, slug: true, icon: true },
    orderBy: { sortOrder: 'asc' },
  });
  type CategoryItem = (typeof categories)[number];

  const description =
    events.length > 0
      ? `${events.length} upcoming event${events.length !== 1 ? 's' : ''}`
      : 'No upcoming events right now - check back soon.';

  return (
    <div className="space-y-8">
      {lens === 'business' && <BusinessLensTracker city={city} surface="events_page" />}

      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel={lens === 'business' ? 'Business events' : 'Events'}
        title={
          lens === 'business' ? `Business Events in ${cityName}` : `Indian Events in ${cityName}`
        }
        description={description}
      />

      {/* Filters - horizontally scrollable on mobile */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {/* Lens filter */}
        <>
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
          <span className="text-border hidden self-center sm:inline">|</span>
        </>

        {/* Category filter (not shown in business lens because category is ignored there) */}
        {lens !== 'business' && (
          <>
            <Link
              href={`/${city}/events`}
              className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
                !filters.category
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-border text-muted hover:border-border hover:text-foreground'
              }`}
            >
              All
            </Link>
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
                  className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
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
              className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium capitalize transition-colors active:opacity-70 ${
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
              className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
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
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
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
