import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { getEventBySlug } from '@/modules/event/queries';

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {event.city.name}
          </a>
          {' / '}
          <a href={`/${city}/events`} className="hover:underline">
            Events
          </a>
          {' / '}
          <span className="text-gray-700">{event.title}</span>
        </nav>

        {/* Header */}
        <div>
          {/* Category tags */}
          {event.categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {event.categories.map(({ category }) => (
                <span
                  key={category.slug}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                >
                  {category.icon} {category.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl leading-tight font-bold">{event.title}</h1>

          {/* Status badge */}
          {isPast && (
            <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
              This event has passed
            </span>
          )}
        </div>

        {/* Key details card */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">📅</span>
            <div>
              <p className="font-medium">{format(startsAt, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-gray-600">
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
                {event.venueAddress && (
                  <p className="text-sm text-gray-600">{event.venueAddress}</p>
                )}
              </div>
            </div>
          ) : null}

          {/* Cost */}
          {event.cost && (
            <div className="flex items-center gap-3">
              <span className="text-xl">🎟️</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  event.cost === 'free'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
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
            <p className="mt-2 leading-relaxed whitespace-pre-line text-gray-700">
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
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {event.community.name.charAt(0)}
              </span>
              {event.community.name}
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <p className="mt-2 text-sm text-gray-500">
              View the community page to join their WhatsApp, Facebook, or other channels.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
