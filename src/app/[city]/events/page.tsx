import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUpcomingEvents } from '@/modules/event/queries';
import { db } from '@/lib/db';
import { EventCard } from '@/components/EventCard';

/**
 * Event Listing — all upcoming events in a city.
 * Supports filters: category, cost, type.
 *
 * Route: /[city]/events/
 * Example: /stuttgart/events/
 * Example: /stuttgart/events/?category=cultural&cost=free
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ category?: string; cost?: string; type?: string }>;
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

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const events = await getUpcomingEvents(city, {
    categorySlug: filters.category,
    limit: 40,
  });

  // Client-side-ish filters for cost and type (applied after fetch)
  let filtered = events;
  if (filters.cost === 'free') {
    filtered = filtered.filter((e) => e.cost === 'free');
  } else if (filters.cost === 'paid') {
    filtered = filtered.filter((e) => e.cost && e.cost !== 'free');
  }
  if (filters.type === 'online') {
    filtered = filtered.filter((e) => e.isOnline);
  } else if (filters.type === 'in-person') {
    filtered = filtered.filter((e) => !e.isOnline);
  }

  const cityName = cityRow.name;

  // Fetch categories for filter bar
  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { name: true, slug: true, icon: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="mb-2 text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityName}
          </a>
          {' / '}
          <span>Events</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Events in {cityName}</h1>
        <p className="mt-2 text-gray-600">
          {filtered.length > 0
            ? `${filtered.length} upcoming event${filtered.length !== 1 ? 's' : ''}`
            : 'No upcoming events right now — check back soon.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5">
          <a
            href={`/${city}/events`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !filters.category
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            All
          </a>
          {categories.map((cat) => {
            const isActive = filters.category === cat.slug;
            const href = `/${city}/events?category=${cat.slug}${filters.cost ? `&cost=${filters.cost}` : ''}${filters.type ? `&type=${filters.type}` : ''}`;
            return (
              <a
                key={cat.slug}
                href={href}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {cat.icon} {cat.name}
              </a>
            );
          })}
        </div>

        {/* Divider */}
        <span className="hidden text-gray-300 sm:inline">|</span>

        {/* Cost filter */}
        {(['free', 'paid'] as const).map((cost) => {
          const isActive = filters.cost === cost;
          const base = `/${city}/events?${filters.category ? `category=${filters.category}&` : ''}`;
          const href = isActive
            ? base.replace(/&$/, '')
            : `${base}cost=${cost}${filters.type ? `&type=${filters.type}` : ''}`;
          return (
            <a
              key={cost}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                isActive
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {cost}
            </a>
          );
        })}

        {/* Type filter */}
        {(['in-person', 'online'] as const).map((type) => {
          const isActive = filters.type === type;
          const base = `/${city}/events?${filters.category ? `category=${filters.category}&` : ''}${filters.cost ? `cost=${filters.cost}&` : ''}`;
          const href = isActive ? base.replace(/&$/, '') : `${base}type=${type}`;
          return (
            <a
              key={type}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                isActive
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {type === 'in-person' ? '📍 In-person' : '🌐 Online'}
            </a>
          );
        })}
      </div>

      {/* Event grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
      )}
    </div>
  );
}
