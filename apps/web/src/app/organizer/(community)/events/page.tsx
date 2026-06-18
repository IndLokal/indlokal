import Link from 'next/link';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { SATELLITE_TO_METRO } from '@/lib/config';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { EventModerationChip } from '@/components/organizer/event-moderation-chip';
import {
  formatEventDateShort,
  formatEventTime,
  formatEventTimeZoneShort,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';

export const metadata = { title: 'Community Events - Organizer' };
export const dynamic = 'force-dynamic';

type OrganizerEventRow = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  status: string;
  moderationState: 'PUBLISHED' | 'PENDING_REVIEW' | 'REJECTED';
  city: { name: string; slug: string; timezone: string };
};

export default async function OrganizerEventsPage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  const events = await db.event.findMany({
    where: { communityId: community.id },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      status: true,
      moderationState: true,
      city: { select: { name: true, slug: true, timezone: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  const now = new Date();
  const upcoming = events.filter((event: OrganizerEventRow) => new Date(event.startsAt) >= now);
  const past = events.filter((event: OrganizerEventRow) => new Date(event.startsAt) < now);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <OrganizerPageHeader
        title="Events"
        description="Manage upcoming and past events for your active community."
        actions={
          <Link
            href="/organizer/events/new"
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            + New Event
          </Link>
        }
      />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />

      {events.length === 0 ? (
        <div className="border-border rounded-[var(--radius-card)] border border-dashed py-16 text-center">
          <p className="text-muted text-sm">No events for this community yet.</p>
          <Link href="/organizer/events/new" className="mt-3 inline-block text-sm underline">
            Publish your first event
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Upcoming ({upcoming.length})</h2>
              <OrganizerEventsTable events={upcoming} />
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-muted mb-3 text-sm font-semibold">Past ({past.length})</h2>
              <OrganizerEventsTable events={past} dim />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OrganizerEventsTable({ events, dim }: { events: OrganizerEventRow[]; dim?: boolean }) {
  return (
    <div className="border-border overflow-hidden rounded-[var(--radius-card)] border">
      <table className={`w-full text-sm ${dim ? 'opacity-60' : ''}`}>
        <thead className="bg-muted-bg">
          <tr className="border-border border-b">
            <th className="px-4 py-2.5 text-left text-xs font-medium">Event</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-medium sm:table-cell">City</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium">Date</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium">Status</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-muted-bg/50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/organizer/events/${event.slug}`}
                  className="font-medium hover:underline"
                >
                  {event.title}
                </Link>
              </td>
              <td className="text-muted hidden px-4 py-3 text-xs sm:table-cell">
                {event.city.name}
              </td>
              <td className="text-muted px-4 py-3 text-xs">
                {formatEventDateShort(
                  new Date(event.startsAt),
                  event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                )}{' '}
                ·{' '}
                {formatEventTime(
                  new Date(event.startsAt),
                  event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                )}
                <span className="text-muted/80">
                  {' '}
                  (
                  {formatEventTimeZoneShort(
                    new Date(event.startsAt),
                    event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                  )}
                  )
                </span>
              </td>
              <td className="px-4 py-3">
                <EventModerationChip
                  status={event.status}
                  moderationState={event.moderationState}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/events/preview/${event.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Preview
                  </Link>
                  {event.moderationState === 'PUBLISHED' ? (
                    <Link
                      href={`/${SATELLITE_TO_METRO[event.city.slug] ?? event.city.slug}/events/${event.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium hover:underline"
                    >
                      View public
                    </Link>
                  ) : null}
                  <Link
                    href={`/organizer/events/${event.slug}/edit`}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Edit details
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
