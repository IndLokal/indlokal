import Link from 'next/link';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const metadata = { title: 'Ambassador Dashboard' };

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border-border rounded-[var(--radius-card)] border bg-white p-5">
      <p className="text-muted text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="text-muted mt-1 text-xs">{sub}</p>}
    </div>
  );
}

type RecentPipelineItem = {
  id: string;
  entityType: string;
  extractedData: unknown;
  confidence: number;
  submittedBy: string | null;
  city: { name: string };
};

type RecentEvent = {
  id: string;
  title: string;
  startsAt: Date;
  community: { name: string } | null;
};

export default async function AmbassadorDashboardPage() {
  const user = await requireCan('ambassador.read');

  const cityIds = user.roleAssignments
    .filter((a) => a.role === 'CITY_AMBASSADOR' && a.cityId && !a.revokedAt)
    .map((a) => a.cityId as string);

  // PLATFORM_ADMIN / OPS_LEAD see all cities
  const cityFilter = cityIds.length > 0 ? { cityId: { in: cityIds } } : {};
  const cityFilterEvents = cityIds.length > 0 ? { community: { cityId: { in: cityIds } } } : {};

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    mySubmissionsThisWeek,
    pendingPipelineItems,
    upcomingEvents,
    unverifiedCommunities,
    recentPipelineItems,
    recentEvents,
  ] = await Promise.all([
    // My fast-track submissions this week
    db.pipelineItem.count({
      where: {
        submittedBy: user.id,
        createdAt: { gte: weekAgo },
        ...cityFilter,
      },
    }),
    // Pending pipeline items in my city
    db.pipelineItem.count({
      where: {
        status: 'PENDING',
        ...cityFilter,
      },
    }),
    // Events happening in the next 7 days in my city
    db.event.count({
      where: {
        startsAt: { gte: now, lte: in7Days },
        status: 'UPCOMING',
        ...cityFilterEvents,
      },
    }),
    // Communities that need attention (no activity in 30 days)
    db.community.count({
      where: {
        status: 'ACTIVE',
        lastActivityAt: {
          lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
        ...cityFilter,
      },
    }),
    // Recent pipeline items in my city
    db.pipelineItem.findMany({
      where: {
        status: 'PENDING',
        ...cityFilter,
      },
      orderBy: [
        // Fast-track items first
        { submittedBy: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        entityType: true,
        extractedData: true,
        confidence: true,
        submittedBy: true,
        createdAt: true,
        city: { select: { name: true } },
      },
    }),
    // Upcoming events in my city
    db.event.findMany({
      where: {
        startsAt: { gte: now, lte: in7Days },
        status: 'UPCOMING',
        ...cityFilterEvents,
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        startsAt: true,
        communityId: true,
        community: { select: { name: true } },
      },
    }),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Ambassador Dashboard"
        description={new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="My submissions" value={mySubmissionsThisWeek} sub="this week" />
        <KpiCard label="Pending review" value={pendingPipelineItems} sub="in your city" />
        <KpiCard label="Upcoming events" value={upcomingEvents} sub="next 7 days" />
        <KpiCard label="Stale communities" value={unverifiedCommunities} sub=">30 days silent" />
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/ambassador/submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
        >
          + Submit community / event
        </Link>
        <Link
          href="/ambassador/feedback"
          className="border-border hover:bg-muted-bg rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Log feedback
        </Link>
        <Link
          href="/ambassador/me"
          className="border-border hover:bg-muted-bg rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
        >
          My scoreboard
        </Link>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Recent pipeline items */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Pending in pipeline
          </h2>
          {recentPipelineItems.length === 0 ? (
            <p className="text-muted text-sm">Nothing pending - all clear!</p>
          ) : (
            <div className="border-border divide-border divide-y overflow-hidden rounded-[var(--radius-card)] border">
              {recentPipelineItems.map((item: RecentPipelineItem) => {
                const d = item.extractedData as Record<string, unknown>;
                const name = (d?.name as string) || (d?.title as string) || '-';
                const isMine = item.submittedBy === user.id;
                return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-muted mt-0.5 text-xs">
                        {item.entityType} · {item.city.name}
                        {isMine && (
                          <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                            mine
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-muted text-xs">
                      {Math.round(item.confidence * 100)}% conf
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming events */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Upcoming events to check in to
          </h2>
          {recentEvents.length === 0 ? (
            <p className="text-muted text-sm">No events in the next 7 days.</p>
          ) : (
            <div className="border-border divide-border divide-y overflow-hidden rounded-[var(--radius-card)] border">
              {recentEvents.map((ev: RecentEvent) => (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{ev.title}</p>
                    <p className="text-muted mt-0.5 text-xs">{ev.community?.name ?? '-'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-muted text-xs">
                      {new Date(ev.startsAt).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <Link
                      href={`/ambassador/checkin/${ev.id}`}
                      className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      Check in →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
