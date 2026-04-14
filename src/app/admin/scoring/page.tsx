import Link from 'next/link';
import { db } from '@/lib/db';
import { subDays } from 'date-fns';
import { ScoringJobPanel } from './ScoringJobPanel';

export const metadata = { title: 'Scoring & Jobs — Admin' };

export default async function AdminScoringPage() {
  const now = new Date();
  const stale90 = subDays(now, 90);
  const stale180 = subDays(now, 180);

  const [
    totalActive,
    trendingCount,
    staleCount,
    veryStaleCount,
    brokenLinksCount,
    staleCommunities,
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
      take: 30,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scoring &amp; Jobs</h1>
          <p className="mt-1 text-sm text-gray-500">Run scoring refresh and maintenance jobs.</p>
        </div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active communities" value={totalActive} color="indigo" />
        <StatCard label="Trending" value={trendingCount} color="green" />
        <StatCard label="Stale (90d)" value={staleCount} color="yellow" />
        <StatCard label="Very stale (180d)" value={veryStaleCount} color="red" />
      </div>

      {brokenLinksCount > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {brokenLinksCount} access channel{brokenLinksCount !== 1 ? 's' : ''} marked as
          unverified — run Link Check to update.
        </div>
      )}

      {/* Job controls */}
      <ScoringJobPanel />

      {/* Stale communities list */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Stale Communities{' '}
          <span className="text-sm font-normal text-gray-400">(no activity in 90+ days)</span>
        </h2>

        {staleCommunities.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">All communities have recent activity.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-gray-600">Community</th>
                  <th className="px-4 py-2 font-medium text-gray-600">City</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Last Activity</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staleCommunities.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${c.city.slug}/communities/${c.slug}`}
                        className="font-medium text-indigo-600 hover:underline"
                        target="_blank"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.city.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.lastActivityAt
                        ? c.lastActivityAt.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {Math.round(c.activityScore ?? 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'indigo' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-sm">{label}</p>
    </div>
  );
}
