import Link from 'next/link';
import { db } from '@/lib/db';
import { runBootstrapAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Data Management — Admin' };

export default async function DataHubPage() {
  const [cityCount, activeCityCount, categoryCount, personaCount, communityCount, eventCount] =
    await Promise.all([
      db.city.count(),
      db.city.count({ where: { isActive: true } }),
      db.category.count({ where: { type: 'CATEGORY' } }),
      db.category.count({ where: { type: 'PERSONA' } }),
      db.community.count(),
      db.event.count(),
    ]);

  const tiles = [
    {
      href: '/admin/data/cities',
      label: 'Cities',
      value: `${activeCityCount} active / ${cityCount}`,
    },
    {
      href: '/admin/data/categories',
      label: 'Categories & Personas',
      value: `${categoryCount} + ${personaCount}`,
    },
    { href: '/admin/data/communities', label: 'Communities', value: communityCount.toString() },
    { href: '/admin/data/events', label: 'Events', value: eventCount.toString() },
    { href: '/admin/data/import', label: 'Bulk Import (CSV / JSON)', value: 'Upload & preview' },
    { href: '/admin/data/health', label: 'Data Health', value: 'Counts & integrity' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Management</h1>
          <p className="text-muted mt-1 text-sm">
            Reference data, content tables, and bulk import for IndLokal.
          </p>
        </div>
        <Link href="/admin" className="text-brand-600 hover:text-brand-700 text-sm hover:underline">
          ← Dashboard
        </Link>
      </div>

      <section className="mt-8 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Bootstrap reference data</h2>
            <p className="mt-1 text-xs text-amber-800">
              Re-runs the idempotent bootstrap (cities, categories, personas). Safe to run anytime —
              uses upserts and never deletes data. Use this if a freshly-migrated database is empty.
            </p>
          </div>
          <form action={runBootstrapAction}>
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Run bootstrap
            </button>
          </form>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-border hover:border-border hover:bg-muted-bg block rounded-[var(--radius-card)] border p-5 transition-colors"
          >
            <div className="text-muted text-xs uppercase tracking-wide">{t.label}</div>
            <div className="mt-1 text-xl font-semibold">{t.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
