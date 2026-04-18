import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { getEventBySlug } from '@/modules/event';
import { ViewTracker } from '@/components/ViewTracker';

/**
 * Event Detail Page
 *
 * Route: /[city]/events/[slug]/
 * Example: /stuttgart/events/holi-stuttgart-2026/
 */

type Props = { params: Promise<{ city: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: 'Event not found' };
  const dateStr = format(new Date(event.startsAt), 'MMM d, yyyy');
  return {
    title: `${event.title} — ${dateStr}`,
    description: event.description ?? `${event.title} in ${event.city.name}, Germany.`,
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { city, slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const isPast = startsAt < new Date();

  // JSON-LD Event schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.startsAt,
    endDate: event.endsAt ?? undefined,
    description: event.description ?? undefined,
    eventStatus: isPast ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.isOnline
      ? { '@type': 'VirtualLocation', url: '' }
      : {
          '@type': 'Place',
          name: event.venueName ?? undefined,
          address: event.venueAddress ?? undefined,
        },
    organizer: event.community
      ? { '@type': 'Organization', name: event.community.name }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }}
      />
      <ViewTracker
        entityType="EVENT"
        entityId={event.id}
        cityId={event.city.id}
        entitySlug={event.slug}
        city={city}
      />

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Breadcrumb */}
        <nav className="text-muted text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {event.city.name}
          </Link>
          {' / '}
          <Link
            href={`/${city}/events`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            Events
          </Link>
          {' / '}
          <span className="text-foreground">{event.title}</span>
        </nav>

        {/* Header */}
        <div>
          {/* Category tags */}
          {event.categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {event.categories.map(({ category }) => (
                <span
                  key={category.slug}
                  className="badge-base bg-brand-50 text-brand-700 ring-brand-600/10 px-3 py-1 text-xs ring-1 ring-inset"
                >
                  {category.icon} {category.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl leading-tight font-bold">{event.title}</h1>

          {/* Recurring badge */}
          {event.isRecurring && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              🔄 Recurring event
              {event.recurrenceRule && (
                <span className="text-blue-500">
                  {' · '}
                  {event.recurrenceRule.includes('WEEKLY')
                    ? 'Weekly'
                    : event.recurrenceRule.includes('MONTHLY')
                      ? 'Monthly'
                      : 'Repeats'}
                </span>
              )}
            </span>
          )}

          {/* Status badge */}
          {isPast && (
            <span className="badge-base bg-muted-bg text-muted mt-2 inline-block px-3 py-1 text-sm">
              This event has passed
            </span>
          )}
        </div>

        {/* Key details card */}
        <div className="card-base space-y-4 p-6">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">📅</span>
            <div>
              <p className="font-medium">{format(startsAt, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-muted text-sm">
                {format(startsAt, 'h:mm a')}
                {endsAt && ` – ${format(endsAt, 'h:mm a')}`}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.isOnline ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-xl">🌐</span>
              <p className="font-medium">Online Event</p>
            </div>
          ) : event.venueName ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-xl">📍</span>
              <div>
                <p className="font-medium">{event.venueName}</p>
                {event.venueAddress && <p className="text-muted text-sm">{event.venueAddress}</p>}
              </div>
            </div>
          ) : null}

          {/* Cost */}
          {event.cost && (
            <div className="flex items-center gap-3">
              <span className="text-xl">🎟️</span>
              <span
                className={`badge-base px-3 py-1 text-sm ${
                  event.cost === 'free'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 ring-inset'
                    : 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/10 ring-inset'
                }`}
              >
                {event.cost === 'free' ? 'Free entry' : event.cost}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div>
            <h2 className="text-lg font-semibold">About this event</h2>
            <p className="text-muted mt-2 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {/* Organiser */}
        {event.community && (
          <div>
            <h2 className="text-lg font-semibold">Organised by</h2>
            <a
              href={`/${city}/communities/${event.community.slug}`}
              className="card-base text-foreground mt-2 inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="bg-brand-100 text-brand-700 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                {event.community.name.charAt(0)}
              </span>
              {event.community.name}
              <span className="text-muted ml-auto">→</span>
            </a>
            <p className="text-muted mt-2 text-sm">
              View the community page to join their WhatsApp, Facebook, or other channels.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
