import Link from 'next/link';
import { db } from '@/lib/db';
import { subDays } from 'date-fns';
import { ScoringJobPanel } from './ScoringJobPanel';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminStatsStrip } from '@/components/admin/stats-strip';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { parseOffsetPagination, buildOffsetPaginationMeta, buildPageHref } from '@/lib/pagination';
import { PaginationControls } from '@/components/ui/PaginationControls';

export const metadata = { title: 'Scoring & Jobs - Admin' };

export default async function AdminScoringPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const now = new Date();
  const stale90 = subDays(now, 90);
  const stale180 = subDays(now, 180);

  // Pagination for stale communities
  const { page, pageSize, skip, take } = parseOffsetPagination(searchParams, {
    defaultPageSize: 30,
    maxPageSize: 100,
  });

  const [
    totalActive,
    trendingCount,
    staleCount,
    veryStaleCount,
    brokenLinksCount,
    staleCommunities,
    totalStaleCount,
  ] = await Promise.all([
    db.community.count({ where: { status: 'ACTIVE' } }),
    db.community.count({ where: { status: 'ACTIVE', isTrending: true } }),
    db.community.count({
      where: {
        status: 'ACTIVE',
        OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: stale90 } }],
      },
    }),
    db.community.count({
      where: {
        status: 'ACTIVE',
        OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: stale180 } }],
      },
    }),
    db.accessChannel.count({ where: { isVerified: false } }),
    db.community.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: stale90 } }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        activityScore: true,
        lastActivityAt: true,
        city: { select: { name: true, slug: true } },
      },
      orderBy: { activityScore: 'asc' },
      skip,
      take,
    }),
    db.community.count({
      where: {
        status: 'ACTIVE',
        OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: stale90 } }],
      },
    }),
  ]);

  type StaleCommunityRow = (typeof staleCommunities)[number];

  const paginationMeta = buildOffsetPaginationMeta({
    page,
    pageSize,
    totalCount: totalStaleCount,
    itemCount: staleCommunities.length,
  });

  const getPageHref = (targetPage: number) =>
    buildPageHref({
      page: targetPage,
      searchParams: { ...searchParams, page: String(targetPage), pageSize: String(pageSize) },
    });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Scoring & Jobs"
        description="Run scoring refresh and maintenance jobs."
        backHref="/admin"
      />

      <div className="mt-8">
        <AdminStatsStrip
          items={[
            { key: 'active', label: 'Active communities', value: totalActive },
            { key: 'trending', label: 'Trending', value: trendingCount },
            { key: 'stale90', label: 'Stale (90d)', value: staleCount },
            { key: 'stale180', label: 'Very stale (180d)', value: veryStaleCount },
          ]}
        />
      </div>

      {brokenLinksCount > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {brokenLinksCount} access channel{brokenLinksCount !== 1 ? 's' : ''} marked as
          unverified - run Link Check to update.
        </div>
      )}

      {/* Job controls */}
      <ScoringJobPanel />

      {/* Stale communities list with pagination */}
      <section className="mt-10">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Stale Communities{' '}
            <span className="text-muted text-sm font-normal">(no activity in 90+ days)</span>
          </h2>
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>

        {staleCommunities.length === 0 ? (
          <p className="text-muted mt-4 text-sm">All communities have recent activity.</p>
        ) : (
          <AdminTableWrap className="mt-4">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Community</AdminTh>
                  <AdminTh>City</AdminTh>
                  <AdminTh>Last Activity</AdminTh>
                  <AdminTh>Score</AdminTh>
                </tr>
              </AdminTableHead>
              <tbody className="divide-border/50 divide-y">
                {staleCommunities.map((c: StaleCommunityRow) => (
                  <tr key={c.id} className="hover:bg-muted-bg">
                    <td className="px-4 py-2">
                      <Link
                        href={`/${c.city.slug}/communities/${c.slug}`}
                        className="text-brand-600 font-medium hover:underline"
                        target="_blank"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-muted px-4 py-2">{c.city.name}</td>
                    <td className="text-muted px-4 py-2">
                      {c.lastActivityAt
                        ? c.lastActivityAt.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {Math.round(c.activityScore ?? 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </AdminTableWrap>
        )}
        <div className="mt-4">
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>
      </section>
    </AdminPage>
  );
}
