import Link from 'next/link';
import { db } from '@/lib/db';
import { setEventStatusAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Events — Admin' };

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const where: {
    city?: { slug: string };
    status?: 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.status && ['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED'].includes(sp.status)) {
    where.status = sp.status as 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  }

  const [events, cities] = await Promise.all([
    db.event.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 200,
      include: {
        city: { select: { name: true, slug: true } },
        community: { select: { name: true, slug: true } },
      },
    }),
    db.city.findMany({ where: { isActive: true }, select: { slug: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link
          href="/admin/data"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Data
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm">
          <div className="text-muted">City</div>
          <select
            name="city"
            defaultValue={sp.city ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">— all —</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-muted">Status</div>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">— any —</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="ONGOING">Ongoing</option>
            <option value="PAST">Past</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      <p className="text-muted mt-4 text-xs">{events.length} shown (cap 200)</p>

      <div className="border-border mt-3 overflow-hidden rounded-[var(--radius-card)] border">
        <table className="w-full text-sm">
          <thead className="border-border bg-muted-bg border-b text-left">
            <tr>
              <th className="text-muted px-3 py-2 font-medium">Title</th>
              <th className="text-muted px-3 py-2 font-medium">When</th>
              <th className="text-muted px-3 py-2 font-medium">City</th>
              <th className="text-muted px-3 py-2 font-medium">Community</th>
              <th className="text-muted px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-muted font-mono text-xs">{e.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.startsAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-xs">{e.city?.name ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{e.community?.name ?? '—'}</td>
                <td className="px-3 py-2">
                  <form action={setEventStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={e.id} />
                    <select
                      name="status"
                      defaultValue={e.status}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="UPCOMING">UPCOMING</option>
                      <option value="ONGOING">ONGOING</option>
                      <option value="PAST">PAST</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                    <button
                      type="submit"
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                    >
                      save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
