import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteCommunityAction, setCommunityStatusAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Communities - Admin' };

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; status?: string; claimState?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const where: {
    city?: { slug: string };
    status?: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
    claimState?: 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
    name?: { contains: string; mode: 'insensitive' };
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.status && ['ACTIVE', 'INACTIVE', 'UNVERIFIED'].includes(sp.status)) {
    where.status = sp.status as 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
  }
  if (sp.claimState && ['UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED'].includes(sp.claimState)) {
    where.claimState = sp.claimState as 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
  }
  if (sp.q) where.name = { contains: sp.q, mode: 'insensitive' };

  const [communities, cities] = await Promise.all([
    db.community.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        city: { select: { name: true, slug: true } },
        _count: { select: { events: true, accessChannels: true } },
      },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader title="Communities" backHref="/admin/data" backLabel="Data" />

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm">
          <div className="text-muted">Search</div>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="name…"
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <div className="text-muted">City</div>
          <select
            name="city"
            defaultValue={sp.city ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">- all -</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-muted">Lifecycle Status</div>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">- any -</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-muted">Claim Status</div>
          <select
            name="claimState"
            defaultValue={sp.claimState ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">- any -</option>
            <option value="UNCLAIMED">Unclaimed</option>
            <option value="CLAIM_PENDING">Claim pending</option>
            <option value="CLAIMED">Claimed</option>
          </select>
        </label>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      <p className="text-muted mt-4 text-xs">{communities.length} shown (cap 200)</p>

      <div className="border-border mt-3 overflow-hidden rounded-[var(--radius-card)] border">
        <table className="w-full text-sm">
          <thead className="border-border bg-muted-bg border-b text-left">
            <tr>
              <th className="text-muted px-3 py-2 font-medium">Community</th>
              <th className="text-muted px-3 py-2 font-medium">City</th>
              <th className="text-muted px-3 py-2 font-medium">Lifecycle Status</th>
              <th className="text-muted px-3 py-2 font-medium">Claim Status</th>
              <th className="text-muted px-3 py-2 font-medium">Events</th>
              <th className="text-muted px-3 py-2 font-medium">Channels</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {communities.map((c) => (
              <tr key={c.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted font-mono text-xs">{c.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{c.city?.name ?? '-'}</td>
                <td className="px-3 py-2">
                  <form action={setCommunityStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <select
                      name="status"
                      defaultValue={c.status}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="UNVERIFIED">UNVERIFIED</option>
                    </select>
                    <button
                      type="submit"
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                    >
                      save
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-xs font-medium">{c.claimState}</td>
                <td className="px-3 py-2 text-xs">{c._count.events}</td>
                <td className="px-3 py-2 text-xs">{c._count.accessChannels}</td>
                <td className="px-3 py-2 text-right">
                  {c.city?.slug && (
                    <Link
                      href={`/${c.city.slug}/communities/${c.slug}`}
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                      target="_blank"
                    >
                      view ↗
                    </Link>
                  )}
                  <form action={deleteCommunityAction} className="ml-3 inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                      title="Permanently delete this community (use for true duplicates / spam only)"
                    >
                      delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
