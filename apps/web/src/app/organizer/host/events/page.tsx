import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { EventModerationChip } from '@/components/organizer/event-moderation-chip';
import { SATELLITE_TO_METRO } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Events - Event Host' };

export default async function HostEventsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  const events = await db.event.findMany({
    where: { createdByUserId: user.id },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      status: true,
      moderationState: true,
      isOnline: true,
      venueName: true,
      city: { select: { name: true, slug: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  const upcoming = events.filter((e: EventRow) => new Date(e.startsAt) >= new Date());
  const past = events.filter((e: EventRow) => new Date(e.startsAt) < new Date());

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="My Events"
        description="View and update your submitted events."
        actions={
          <Link
            href="/organizer/host/events/new"
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            + New Event
          </Link>
        }
      />

      {events.length === 0 ? (
        <div className="border-border rounded-[var(--radius-card)] border border-dashed py-16 text-center">
          <p className="text-muted text-sm">No events yet.</p>
          <Link href="/organizer/host/events/new" className="mt-3 inline-block text-sm underline">
            Post your first event
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Upcoming ({upcoming.length})</h2>
              <EventTable events={upcoming} />
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-muted mb-3 text-sm font-semibold">Past ({past.length})</h2>
              <EventTable events={past} dim />
            </section>
          )}
        </>
      )}
    </div>
  );
}

type EventRow = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  status: string;
  moderationState: 'PUBLISHED' | 'PENDING_REVIEW' | 'REJECTED';
  isOnline: boolean;
  venueName: string | null;
  city: { name: string; slug: string };
};

function EventTable({ events, dim }: { events: EventRow[]; dim?: boolean }) {
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
          {events.map((ev) => (
            <tr key={ev.id} className="hover:bg-muted-bg/50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/organizer/host/events/${ev.slug}`}
                  className="font-medium hover:underline"
                >
                  {ev.title}
                </Link>
              </td>
              <td className="text-muted hidden px-4 py-3 text-xs sm:table-cell">{ev.city.name}</td>
              <td className="text-muted px-4 py-3 text-xs">
                {format(new Date(ev.startsAt), 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3">
                <EventModerationChip status={ev.status} moderationState={ev.moderationState} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/events/preview/${ev.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Preview
                  </Link>
                  {ev.moderationState === 'PUBLISHED' ? (
                    <Link
                      href={`/${SATELLITE_TO_METRO[ev.city.slug] ?? ev.city.slug}/events/${ev.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium hover:underline"
                    >
                      View public
                    </Link>
                  ) : null}
                  <Link
                    href={`/organizer/host/events/${ev.slug}/edit`}
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
