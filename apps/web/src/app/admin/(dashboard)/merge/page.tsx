import Link from 'next/link';
import { db } from '@/lib/db';
import { MergeCommunityForm } from './merge-community-form';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const metadata = { title: 'Merge Communities - Admin' };

export default async function AdminMergePage() {
  const loadCommunities = () =>
    db.community.findMany({
      where: { mergedIntoId: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        claimState: true,
        updatedAt: true,
        city: { select: { name: true, slug: true } },
      },
      orderBy: [{ city: { name: 'asc' } }, { name: 'asc' }],
    });
  const loadCities = () =>
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  const loadRecentMerges = () =>
    db.community.findMany({
      where: { mergedIntoId: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
        mergedInto: { select: { name: true, slug: true, city: { select: { slug: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

  let communities: Awaited<ReturnType<typeof loadCommunities>> = [];
  let cities: Awaited<ReturnType<typeof loadCities>> = [];
  let recentMerges: Awaited<ReturnType<typeof loadRecentMerges>> = [];
  let loadError: string | null = null;

  try {
    [communities, cities] = await Promise.all([loadCommunities(), loadCities()]);
    recentMerges = await loadRecentMerges();
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    console.error('[admin/merge] failed to load merge data', error);
  }

  type RecentMerge = (typeof recentMerges)[number];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Merge Communities"
        description="Move events, channels, trust history, and claims from a duplicate record into a canonical one."
        backHref="/admin"
      />

      {loadError ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Merge data is temporarily unavailable. This usually means the database schema is out of
          sync with this deploy. Check server logs for details.
        </div>
      ) : null}

      {!loadError ? <MergeCommunityForm communities={communities} cities={cities} /> : null}

      {recentMerges.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recent Merges</h2>
          <div className="mt-4 space-y-3">
            {recentMerges.map((community: RecentMerge) => (
              <div
                key={community.id}
                className="card-base flex items-center justify-between p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{community.name}</p>
                  <p className="text-muted mt-1">
                    Redirects to{' '}
                    {community.mergedInto && community.mergedInto.city ? (
                      <Link
                        href={`/${community.mergedInto.city.slug}/communities/${community.mergedInto.slug}`}
                        className="text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {community.mergedInto.name}
                      </Link>
                    ) : (
                      'unknown target'
                    )}
                  </p>
                </div>
                <span className="text-muted text-xs">
                  {community.updatedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
