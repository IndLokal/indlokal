import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { discovery as d } from '@indlokal/shared';
import { db } from '@/lib/db';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { countUpcomingEvents, getUpcomingEvents } from '@/modules/event';
import { EventCard } from '@/components/EventCard';
import { BusinessLensTracker } from '@/components/analytics';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageEmptyState } from '@/components/city/CitySubpageEmptyState';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Business and Careers Events in ${cityName}`,
    description: `Discover Indian business networking, professional meetups, startup gatherings, and career events in ${cityName}.`,
    alternates: {
      canonical: `/${city}/business-events`,
    },
  };
}

export default async function BusinessEventsPage({ params, searchParams }: Props) {
  const { city } = await params;
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp, { defaultPageSize: 24, maxPageSize: 48 });

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const [totalEventCount, events] = await Promise.all([
    countUpcomingEvents(city, {
      categorySlugs: [...d.BUSINESS_EVENT_CATEGORY_SLUGS],
    }),
    getUpcomingEvents(city, {
      categorySlugs: [...d.BUSINESS_EVENT_CATEGORY_SLUGS],
      limit: pagination.take,
      offset: pagination.skip,
    }),
  ]);

  const cityName = cityRow.name;
  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount: totalEventCount,
    itemCount: events.length,
  });
  const description =
    totalEventCount > 0
      ? `${totalEventCount} upcoming professional and networking events`
      : `No business events listed right now in ${cityName}.`;

  return (
    <div className="space-y-8">
      <BusinessLensTracker
        city={city}
        surface="business_events_page"
        resultCount={totalEventCount}
      />

      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel="Business events"
        title={`Business and Careers Events in ${cityName}`}
        description={description}
      />

      {events.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} city={city} lens="business" />
            ))}
          </div>
          <PaginationControls
            meta={paginationMeta}
            getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
          />
        </>
      ) : (
        <CitySubpageEmptyState
          title="No business events yet"
          description="Try the full events feed or browse active communities for upcoming updates."
          actions={[
            { href: `/${city}/events`, label: 'View all events', variant: 'primary' },
            { href: `/${city}/communities`, label: 'Browse communities' },
          ]}
        />
      )}

      <div className="border-border/50 bg-muted-bg flex flex-wrap items-center justify-center gap-3 rounded-[var(--radius-card)] border p-4">
        <Link href={`/${city}/events`} className="btn-primary px-4 py-2 text-sm">
          All events
        </Link>
        <Link
          href={`/${city}/resources/business-setup`}
          className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline"
        >
          Business setup resources →
        </Link>
      </div>

      <CitySeoTemplateSection city={city} cityName={cityName} topic="business-events" />
    </div>
  );
}
