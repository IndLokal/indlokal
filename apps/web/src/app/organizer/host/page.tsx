import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const dynamic = 'force-dynamic';

export default async function HostDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  // Host profile from User.metadata
  const profile = (user.metadata as Record<string, unknown> | null)?.hostProfile as
    | { displayName?: string; links?: string[] }
    | undefined;

  // Count upcoming events
  const upcomingCount = await db.event.count({
    where: {
      metadata: { path: ['hostUserId'], equals: user.id },
      startsAt: { gte: new Date() },
      status: { not: 'CANCELLED' },
    },
  });

  // Count unverified upcoming events (cap enforcement)
  const unverifiedUpcomingCount = await db.event.count({
    where: {
      metadata: { path: ['hostUserId'], equals: user.id },
      startsAt: { gte: new Date() },
      status: 'UPCOMING',
      source: { not: 'ADMIN_SEED' },
      trustSignals: { none: {} },
    },
  });

  const CAP = 5;
  const atCap = unverifiedUpcomingCount >= CAP;

  return (
    <div className="space-y-8">
      <div>
        <OrganizerPageHeader
          title={profile?.displayName ?? user.displayName ?? user.email}
          description="Your host space"
        />
        {profile?.links && profile.links.length > 0 && (
          <div className="-mt-4 flex flex-wrap gap-2">
            {profile.links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-brand-600 text-sm underline decoration-dashed"
              >
                {new URL(link).hostname}
              </a>
            ))}
          </div>
        )}
      </div>

      {atCap && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <p className="text-sm font-medium">
            You have {unverifiedUpcomingCount} unverified upcoming events (cap: {CAP}).
          </p>
          <p className="mt-1 text-sm">
            Once a team member reviews your events, you can post more. In the meantime you can still
            edit existing events.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/organizer/host/events/new"
          className={`card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${atCap ? 'pointer-events-none opacity-40' : ''}`}
        >
          <div className="text-2xl">📅</div>
          <h2 className="text-foreground mt-3 font-semibold">Post an Event</h2>
          <p className="text-muted mt-1 text-sm">
            Add an upcoming event to the IndLokal feed for your city
          </p>
        </Link>

        <Link
          href="/organizer/host/events"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">📋</div>
          <h2 className="text-foreground mt-3 font-semibold">My Events</h2>
          <p className="text-muted mt-1 text-sm">
            {upcomingCount} upcoming event{upcomingCount !== 1 ? 's' : ''} - view and edit
          </p>
        </Link>
      </div>
    </div>
  );
}
