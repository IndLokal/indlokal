import Link from 'next/link';
import { format } from 'date-fns';
import type { Event as PrismaEvent } from '@prisma/client';
import { ViewTracker } from '@/components/analytics';
import { escapeJsonForHtmlScript } from '@/lib/html';
import { EventSaveButton } from '@/components/EventSaveButton';
import { EventRegistrationLink } from '@/components/EventRegistrationLink';

type EventWithRelations = PrismaEvent & {
  city: { id: string; name: string; slug?: string };
  community?: { id: string; name: string; slug?: string } | null;
  categories: { category: { slug: string; icon?: string; name: string } }[];
};

export default function EventDetailServer({
  event,
  city,
  savedByUser,
  hostDisplayName,
  lensContext,
}: {
  event: EventWithRelations;
  city: string;
  savedByUser?: boolean;
  hostDisplayName?: string | null;
  lensContext?: 'business_careers' | undefined;
}) {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const isPast = startsAt < new Date();
  const virtualLocationUrl = event.onlineLink || event.registrationUrl || null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: new Date(event.startsAt).toISOString(),
    endDate: event.endsAt ? new Date(event.endsAt).toISOString() : undefined,
    description: event.description ?? undefined,
    eventStatus: isPast ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.isOnline
      ? virtualLocationUrl
        ? { '@type': 'VirtualLocation', url: virtualLocationUrl }
        : undefined
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
        dangerouslySetInnerHTML={{ __html: escapeJsonForHtmlScript(jsonLd) }}
      />
      <ViewTracker
        entityType="EVENT"
        entityId={event.id}
        cityId={event.city.id}
        entitySlug={event.slug}
        city={city}
        metadata={lensContext ? { lens_context: lensContext } : undefined}
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

        {/* Header and other details similar to previous page */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {event.categories.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {event.categories.map(({ category }: EventWithRelations['categories'][number]) => (
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

            {event.isRecurring && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                🔄 Recurring event
              </span>
            )}

            {isPast && (
              <span className="badge-base bg-muted-bg text-muted mt-2 inline-block px-3 py-1 text-sm">
                This event has passed
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
            <EventSaveButton
              eventId={event.id}
              saved={!!savedByUser}
              city={city}
              lensContext={lensContext}
            />
            {event.registrationUrl && (
              <EventRegistrationLink
                href={event.registrationUrl}
                eventId={event.id}
                city={city}
                lensContext={lensContext}
              />
            )}
          </div>
        </div>

        <div className="card-base space-y-4 p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">📅</span>
            <div>
              <p className="font-medium">{format(startsAt, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-muted text-sm">
                {format(startsAt, 'h:mm a')}
                {endsAt && ` - ${format(endsAt, 'h:mm a')}`}
              </p>
            </div>
          </div>

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

          {event.cost && (
            <div className="flex items-center gap-3">
              <span className="text-xl">🎟️</span>
              <span
                className={`badge-base px-3 py-1 text-sm ${event.cost === 'free' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}
              >
                {event.cost === 'free' ? 'Free entry' : event.cost}
              </span>
            </div>
          )}
        </div>

        {event.description && (
          <div>
            <h2 className="text-lg font-semibold">About this event</h2>
            <p className="text-muted mt-2 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

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
              View the community page to join their channels.
            </p>
          </div>
        )}

        {!event.community && hostDisplayName && (
          <div>
            <h2 className="text-lg font-semibold">Hosted by</h2>
            <div className="card-base mt-2 inline-flex items-center gap-2 px-4 py-3 text-sm font-medium">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                {hostDisplayName.charAt(0).toUpperCase()}
              </span>
              {hostDisplayName}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
