import Link from 'next/link';
import { db } from '@/lib/db';
import { MergeCommunityForm } from './merge-community-form';

export const metadata = { title: 'Merge Communities - Admin' };

export default async function AdminMergePage() {
  const [communities, cities] = await Promise.all([
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
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const recentMerges = await db.community.findMany({
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

  type RecentMerge = (typeof recentMerges)[number];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Merge Communities</h1>
          <p className="text-muted mt-1 text-sm">
            Move events, channels, trust history, and claims from a duplicate record into a
            canonical one.
          </p>
        </div>
        <Link href="/admin" className="text-brand-600 hover:text-brand-700 text-sm hover:underline">
          ← Dashboard
        </Link>
      </div>

      <MergeCommunityForm communities={communities} cities={cities} />

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
                    {community.mergedInto ? (
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
    </div>
  );
}
