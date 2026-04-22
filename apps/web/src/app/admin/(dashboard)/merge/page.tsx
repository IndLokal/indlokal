import Link from 'next/link';
import { db } from '@/lib/db';
import { mergeCommunities } from './actions';

export const metadata = { title: 'Merge Communities — Admin' };

export default async function AdminMergePage() {
  const communities = await db.community.findMany({
    where: { mergedIntoId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      claimState: true,
      city: { select: { name: true, slug: true } },
    },
    orderBy: [{ city: { name: 'asc' } }, { name: 'asc' }],
  });

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
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

      <form action={mergeCommunities} className="card-base mt-8 space-y-5 p-6">
        <div>
          <h2 className="font-semibold">Merge Pair</h2>
          <p className="text-muted mt-1 text-sm">
            The secondary community will become inactive and redirect to the primary community page.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Primary community</span>
            <select name="primaryId" className="input-base mt-2 w-full" required>
              <option value="">Select canonical record</option>
              {communities
                .filter((community) => community.status !== 'INACTIVE')
                .map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name} · {community.city.name} · {community.status}
                  </option>
                ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Secondary community</span>
            <select name="secondaryId" className="input-base mt-2 w-full" required>
              <option value="">Select duplicate record</option>
              {communities
                .filter((community) => community.status !== 'INACTIVE')
                .map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name} · {community.city.name} · {community.claimState}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <button type="submit" className="btn-primary">
          Merge Communities
        </button>
      </form>

      {recentMerges.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recent Merges</h2>
          <div className="mt-4 space-y-3">
            {recentMerges.map((community) => (
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
