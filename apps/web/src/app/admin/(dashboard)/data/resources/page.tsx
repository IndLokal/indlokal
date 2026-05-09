import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteResourceAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resources — Admin' };

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; type?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const where: {
    city?: { slug: string };
    resourceType?: string;
    title?: { contains: string; mode: 'insensitive' };
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.type) where.resourceType = sp.type;
  if (sp.q) where.title = { contains: sp.q, mode: 'insensitive' };

  const [resources, cities] = await Promise.all([
    db.resource.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { city: { select: { name: true, slug: true } } },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const types = [
    'CONSULAR_SERVICE',
    'OFFICIAL_EVENT',
    'GOVERNMENT_INFO',
    'VISA_SERVICE',
    'CITY_REGISTRATION',
    'DRIVING',
    'HOUSING',
    'HEALTH_DOCTORS',
    'FAMILY_CHILDREN',
    'JOBS_CAREERS',
    'TAX_FINANCE',
    'BUSINESS_SETUP',
    'GROCERY_FOOD',
    'COMMUNITY_RESOURCE',
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resources</h1>
        <Link
          href="/admin/data"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Data
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm">
          <div className="text-muted">Search</div>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="title…"
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
            <option value="">— all —</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-muted">Type</div>
          <select
            name="type"
            defaultValue={sp.type ?? ''}
            className="border-border mt-1 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">— any —</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      <p className="text-muted mt-4 text-xs">{resources.length} shown (cap 200)</p>

      <div className="border-border mt-3 overflow-hidden rounded-[var(--radius-card)] border">
        <table className="w-full text-sm">
          <thead className="border-border bg-muted-bg border-b text-left">
            <tr>
              <th className="text-muted px-3 py-2 font-medium">Title</th>
              <th className="text-muted px-3 py-2 font-medium">Type</th>
              <th className="text-muted px-3 py-2 font-medium">City</th>
              <th className="text-muted px-3 py-2 font-medium">URL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-muted font-mono text-xs">{r.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.resourceType}</td>
                <td className="px-3 py-2 text-xs">{r.city?.name ?? '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      open ↗
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={deleteResourceAction} className="inline-block">
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                      title="Permanently delete this resource"
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
    </div>
  );
}
