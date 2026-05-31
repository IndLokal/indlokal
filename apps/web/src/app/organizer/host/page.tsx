import Link from 'next/link';
import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { EventModerationChip } from '@/components/organizer/event-moderation-chip';
import {
  getHostProfile,
  getHostEventStats,
  computeHostCompleteness,
  HOST_UNVERIFIED_CAP,
} from '@/lib/organizer/host-workspace';

export const dynamic = 'force-dynamic';

function hostname(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}

export default async function HostDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  const profile = getHostProfile(user);
  const stats = await getHostEventStats(user.id);
  const completeness = computeHostCompleteness(
    profile,
    stats.live + stats.past + stats.inReview > 0,
  );

  const atCap = stats.unverifiedUpcomingCount >= HOST_UNVERIFIED_CAP;

  const statTiles = [
    { label: 'Live', value: stats.live, hint: 'Published & upcoming' },
    { label: 'In review', value: stats.inReview, hint: 'Awaiting approval' },
    { label: 'Declined', value: stats.declined, hint: 'Needs a fix' },
    { label: 'Past', value: stats.past, hint: 'Already happened' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <OrganizerPageHeader
          title={profile.displayName ?? user.displayName ?? user.email}
          description="Your host space"
        />
        {profile.links.length > 0 && (
          <div className="-mt-4 flex flex-wrap gap-2">
            {profile.links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-brand-600 text-sm underline decoration-dashed"
              >
                {hostname(link)}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* My events at a glance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statTiles.map((tile) => (
          <div key={tile.label} className="card-base p-4">
            <p className="text-foreground text-2xl font-semibold">{tile.value}</p>
            <p className="text-foreground mt-0.5 text-sm font-medium">{tile.label}</p>
            <p className="text-muted mt-0.5 text-xs">{tile.hint}</p>
          </div>
        ))}
      </div>

      {/* Review standing / cap */}
      {atCap ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <p className="text-sm font-medium">
            You have {stats.unverifiedUpcomingCount} events awaiting review (cap:{' '}
            {HOST_UNVERIFIED_CAP}).
          </p>
          <p className="mt-1 text-sm">
            Once a team member reviews your events, you can post more. In the meantime you can still
            edit existing events.
          </p>
        </div>
      ) : (
        stats.unverifiedUpcomingCount > 0 && (
          <p className="text-muted text-sm">
            {stats.unverifiedUpcomingCount} of {HOST_UNVERIFIED_CAP} review slots in use — your
            pending events go live once a team member approves them.
          </p>
        )
      )}

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/organizer/host/events/new"
          className={`card-base group min-h-[148px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${atCap ? 'pointer-events-none opacity-40' : ''}`}
        >
          <span className="bg-brand-50 text-brand-700 border-brand-100 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
            Event
          </span>
          <h2 className="text-foreground mt-3 text-lg font-semibold leading-6">Post an event</h2>
          <p className="text-muted mt-1 text-sm leading-6">
            Add an upcoming event to the IndLokal feed for your city. Reviewed before going live.
          </p>
        </Link>

        <Link
          href="/organizer/host/events"
          className="card-base group min-h-[148px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="bg-brand-50 text-brand-700 border-brand-100 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
            Events
          </span>
          <h2 className="text-foreground mt-3 text-lg font-semibold leading-6">My events</h2>
          <p className="text-muted mt-1 text-sm leading-6">
            {stats.upcoming} upcoming event{stats.upcoming !== 1 ? 's' : ''} — view, edit, and track
            status.
          </p>
        </Link>

        <Link
          href="/organizer/host/profile"
          className="card-base group min-h-[148px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="bg-brand-50 text-brand-700 border-brand-100 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
            Profile
          </span>
          <h2 className="text-foreground mt-3 text-lg font-semibold leading-6">Host Profile</h2>
          <p className="text-muted mt-1 text-sm leading-6">
            Edit your public name, city, and links — how you appear as the host.
          </p>
        </Link>
      </div>

      {/* Next up */}
      {stats.nextUpcoming && (
        <div className="card-base p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-semibold">Next up</h2>
            <Link
              href={`/organizer/host/events/${stats.nextUpcoming.slug}`}
              className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
            >
              View →
            </Link>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-foreground truncate font-medium">{stats.nextUpcoming.title}</p>
              <p className="text-muted mt-0.5 text-sm">
                {format(new Date(stats.nextUpcoming.startsAt), 'EEE, d MMM yyyy · HH:mm')} ·{' '}
                {stats.nextUpcoming.isOnline
                  ? 'Online'
                  : (stats.nextUpcoming.venueName ?? stats.nextUpcoming.city.name)}
              </p>
            </div>
            <EventModerationChip
              moderationState={stats.nextUpcoming.moderationState}
              status={stats.nextUpcoming.status}
            />
          </div>
        </div>
      )}

      {/* Needs attention — declined events */}
      {stats.declinedEvents.length > 0 && (
        <div className="card-base border-amber-200 p-6">
          <h2 className="text-foreground text-lg font-semibold">Needs attention</h2>
          <p className="text-muted mt-1 text-sm">
            These events were declined. Edit and resubmit to send them back to review.
          </p>
          <ul className="mt-4 space-y-3">
            {stats.declinedEvents.map((e) => (
              <li
                key={e.id}
                className="border-border flex items-start justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/organizer/host/events/${e.slug}/edit`}
                    className="text-foreground font-medium hover:underline"
                  >
                    {e.title}
                  </Link>
                  {e.reviewReason && (
                    <p className="text-muted mt-0.5 text-sm">Reason: {e.reviewReason}</p>
                  )}
                </div>
                <EventModerationChip moderationState={e.moderationState} status={e.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Profile completeness */}
      <div className="card-base p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Profile completeness</h2>
          <span className="text-brand-600 text-sm font-medium">{completeness.pct}%</span>
        </div>
        <div className="bg-muted-bg mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-brand-500 h-full rounded-full transition-all"
            style={{ width: `${completeness.pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {completeness.items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.done ? 'text-success' : 'text-border'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted'}>{item.label}</span>
            </div>
          ))}
        </div>
        {completeness.pct < 100 && (
          <Link
            href="/organizer/host/profile"
            className="text-brand-600 hover:text-brand-700 mt-4 inline-block text-sm font-medium hover:underline"
          >
            Complete Host Profile →
          </Link>
        )}
      </div>
    </div>
  );
}
