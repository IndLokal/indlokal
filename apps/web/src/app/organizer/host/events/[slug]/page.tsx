import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { EventModerationChip } from '@/components/organizer/event-moderation-chip';
import { ConfirmSubmitButton } from '@/components/ui';
import { archiveHostEvent } from './actions';
import { SATELLITE_TO_METRO } from '@/lib/config';
import {
  formatEventDateTimeMedium,
  formatEventTime,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Event Summary - Event Host' };

type Props = { params: Promise<{ slug: string }> };

export default async function HostEventSummaryPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const event = await db.event.findFirst({
    where: { slug, createdByUserId: user.id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineLink: true,
      registrationUrl: true,
      imageUrl: true,
      cost: true,
      costType: true,
      accessType: true,
      status: true,
      moderationState: true,
      city: { select: { slug: true, name: true, timezone: true } },
    },
  });

  if (!event) notFound();

  const canonicalCity = event.city?.slug
    ? (SATELLITE_TO_METRO[event.city.slug] ?? event.city.slug)
    : null;
  const publicHref = canonicalCity ? `/${canonicalCity}/events/${event.slug}` : `/${event.slug}`;
  const canViewPublic = event.moderationState === 'PUBLISHED';
  const archiveCurrentEvent = archiveHostEvent.bind(null, event.slug);

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Event Summary"
        description={`Internal management view for ${event.title}.`}
        backHref="/organizer/host/events"
      />

      <div className="card-base space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{event.title}</h2>
            <p className="text-muted mt-1 text-sm">
              {event.city.name} ·{' '}
              {formatEventDateTimeMedium(
                new Date(event.startsAt),
                event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
              )}
              {event.endsAt
                ? ` - ${formatEventTime(new Date(event.endsAt), event.city.timezone ?? DEFAULT_EVENT_TIMEZONE)}`
                : ''}
            </p>
          </div>

          <EventModerationChip status={event.status} moderationState={event.moderationState} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Venue</p>
            <p className="mt-1 text-sm">
              {event.venueName ?? '—'}
              {event.venueAddress ? (
                <span className="text-muted"> · {event.venueAddress}</span>
              ) : (
                ''
              )}
            </p>
          </div>
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Cost</p>
            <p className="mt-1 text-sm">
              {event.costType === 'FREE'
                ? 'Free'
                : event.costType === 'PAID'
                  ? (event.cost ?? 'Paid')
                  : (event.cost ?? '—')}
            </p>
          </div>
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Entry</p>
            <p className="mt-1 text-sm">{event.accessType.replace(/_/g, ' ').toLowerCase()}</p>
          </div>
        </div>

        {event.description && (
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Description</p>
            <p className="mt-1 text-sm leading-6 whitespace-pre-line">{event.description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`/events/preview/${event.slug}`}
            target="_blank"
            rel="noreferrer"
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
          >
            Preview
          </Link>
          <Link
            href={`/organizer/host/events/${event.slug}/edit`}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Edit details
          </Link>
          {canViewPublic && (
            <Link
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="border-border rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              View public page
            </Link>
          )}
          <form action={archiveCurrentEvent}>
            <ConfirmSubmitButton
              triggerLabel="Cancel / archive event"
              title="Cancel and archive this event?"
              description="The event will be cancelled and removed from active host listings."
              confirmLabel="Archive event"
              tone="danger"
              triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            />
          </form>
        </div>

        <p className="text-muted text-xs">
          Host edits send the event back to review before it returns to the public feed.
        </p>
      </div>
    </div>
  );
}
