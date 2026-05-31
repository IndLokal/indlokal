import Link from 'next/link';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { EventModerationChip } from '@/components/organizer/event-moderation-chip';
import { archiveEvent } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Event Summary - Organizer' };

type Props = { params: Promise<{ slug: string }> };

export default async function OrganizerEventSummaryPage({ params }: Props) {
  const { slug } = await params;
  const { user, community, role } = await requireOrganizerWorkspace();

  if (!community || !canEditCommunity(user, community.id)) {
    notFound();
  }

  const event = await db.event.findFirst({
    where: { slug, communityId: community.id },
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
      status: true,
      moderationState: true,
      city: { select: { slug: true, name: true } },
    },
  });

  if (!event) notFound();

  const publicHref = `/${event.city.slug}/events/${event.slug}`;

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Event Summary"
        description={`Internal management view for ${event.title}.`}
        backHref="/organizer/events"
      />

      <div className="card-base space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{event.title}</h2>
            <p className="text-muted mt-1 text-sm">
              {event.city.name} · {format(new Date(event.startsAt), 'EEE, dd MMM yyyy h:mm a')}
              {event.endsAt ? ` - ${format(new Date(event.endsAt), 'h:mm a')}` : ''}
            </p>
          </div>

          <EventModerationChip status={event.status} moderationState={event.moderationState} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted text-xs uppercase tracking-wide">Venue</p>
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
            <p className="text-muted text-xs uppercase tracking-wide">Cost</p>
            <p className="mt-1 text-sm">{event.cost ?? '—'}</p>
          </div>
        </div>

        {event.description && (
          <div>
            <p className="text-muted text-xs uppercase tracking-wide">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6">{event.description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`/organizer/events/${event.slug}/edit`}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Edit details
          </Link>
          <Link
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
          >
            View public page
          </Link>
          <form action={archiveEvent}>
            <input type="hidden" name="slug" value={event.slug} />
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Archive event
            </button>
          </form>
        </div>

        <p className="text-muted text-xs">
          {role === 'COMMUNITY_ADMIN'
            ? 'You manage this community as the organizer.'
            : 'You can edit this event as a collaborator on the active community.'}
        </p>
      </div>
    </div>
  );
}
