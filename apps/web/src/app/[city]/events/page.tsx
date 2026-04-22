import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUpcomingEvents } from '@/modules/event';
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
    limit: 16,
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
        <nav className="text-muted mb-2 text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityName}
          </Link>
          {' / '}
          <span>Events</span>
        </nav>
        <h1 className="text-3xl font-bold">Indian Events in {cityName}</h1>
        <p className="text-muted mt-2">
          {filtered.length > 0
            ? `${filtered.length} upcoming event${filtered.length !== 1 ? 's' : ''}`
            : 'No upcoming events right now — check back soon.'}
        </p>
      </div>

      {/* Filters — horizontally scrollable on mobile */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {/* Category filter */}
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
        {categories.map((cat) => {
          const isActive = filters.category === cat.slug;
          const href = `/${city}/events?category=${cat.slug}${filters.cost ? `&cost=${filters.cost}` : ''}${filters.type ? `&type=${filters.type}` : ''}`;
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

        {/* Cost filter */}
        {(['free', 'paid'] as const).map((cost) => {
          const isActive = filters.cost === cost;
          const base = `/${city}/events?${filters.category ? `category=${filters.category}&` : ''}`;
          const href = isActive
            ? base.replace(/&$/, '')
            : `${base}cost=${cost}${filters.type ? `&type=${filters.type}` : ''}`;
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
          const isActive = filters.type === type;
          const base = `/${city}/events?${filters.category ? `category=${filters.category}&` : ''}${filters.cost ? `cost=${filters.cost}&` : ''}`;
          const href = isActive ? base.replace(/&$/, '') : `${base}type=${type}`;
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
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} city={city} />
          ))}
        </div>
      )}

      {/* Cross-links */}
      <div className="border-border/50 bg-muted-bg text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border p-4 text-sm">
        <Link
          href={`/${city}/communities`}
          className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
        >
          Browse communities →
        </Link>
        <span className="text-border hidden sm:inline">|</span>
        <Link
          href={`/${city}/search`}
          className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
        >
          Search everything →
        </Link>
      </div>
    </div>
  );
}
