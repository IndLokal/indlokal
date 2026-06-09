import Link from 'next/link';
import { requireCan } from '@/lib/auth/permissions';
import { getAmbassadorCityIds } from '@/lib/auth/ambassador';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminStatsStrip } from '@/components/admin/stats-strip';
import { Badge, EmptyState, SectionHeader } from '@/components/ui';
import type { ExtractedCommunity, ExtractedEvent } from '@/modules/pipeline';

export const metadata = { title: 'Ambassador Dashboard' };

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

function getPipelineItemName(item: RecentPipelineItem) {
  const data = item.extractedData as ExtractedEvent | ExtractedCommunity;
  if (data && 'type' in data) {
    return data.type === 'EVENT' ? data.title : data.name;
  }

  const fallback = item.extractedData as Record<string, unknown>;
  return (fallback?.name as string) || (fallback?.title as string) || '-';
}

export default async function AmbassadorDashboardPage() {
  const user = await requireCan('ambassador.read');

  const cityIds = getAmbassadorCityIds(user);

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
        actions={
          <AdminStatsStrip
            items={[
              { key: 'submissions', label: 'My submissions', value: mySubmissionsThisWeek },
              { key: 'pending', label: 'Pending review', value: pendingPipelineItems },
              { key: 'events', label: 'Upcoming events', value: upcomingEvents },
              { key: 'stale', label: 'Stale communities', value: unverifiedCommunities },
            ]}
          />
        }
      />

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
          <SectionHeader
            title="Pending in pipeline"
            subtitle="Fast-track queue items in your city scope."
          />
          {recentPipelineItems.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="✅"
                title="Nothing pending"
                description="All clear in your pipeline queue."
              />
            </div>
          ) : (
            <div className="card-base divide-border mt-4 divide-y">
              {recentPipelineItems.map((item: RecentPipelineItem) => {
                const name = getPipelineItemName(item);
                const isMine = item.submittedBy === user.id;
                const confidenceVariant =
                  item.confidence >= 0.85
                    ? 'success'
                    : item.confidence >= 0.6
                      ? 'warning'
                      : 'danger';
                return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge>{item.entityType}</Badge>
                        <Badge variant="muted">{item.city.name}</Badge>
                        {isMine && <Badge variant="info">Mine</Badge>}
                      </div>
                    </div>
                    <Badge variant={confidenceVariant}>
                      {Math.round(item.confidence * 100)}% conf
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming events */}
        <section>
          <SectionHeader
            title="Upcoming events to check in to"
            subtitle="Events in the next 7 days within your city scope."
          />
          {recentEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="🗓️"
                title="No events in the next 7 days"
                description="You’re all caught up for upcoming ambassador check-ins."
              />
            </div>
          ) : (
            <div className="card-base divide-border mt-4 divide-y">
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
