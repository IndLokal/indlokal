import Link from 'next/link';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { OutreachKanban } from './OutreachKanban';
import { CreateLeadForm } from './CreateLeadForm';
import type { OutreachStage } from '@prisma/client';

export const metadata = { title: 'Outreach CRM - Admin' };
export const dynamic = 'force-dynamic';

const STAGE_ORDER: OutreachStage[] = [
  'NEW',
  'RESEARCHING',
  'CONTACTED',
  'IN_CONVERSATION',
  'ONBOARDED',
  'DECLINED',
  'DORMANT',
];

export default async function AdminOutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCan('outreach.read');

  const sp = await searchParams;
  const filterCity = sp.city || '';
  const filterOwner = sp.owner || '';
  const filterSource = sp.source || '';
  const filterAge = sp.age ? parseInt(sp.age, 10) : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  const now = new Date();
  if (filterCity) where.cityId = filterCity;
  if (filterOwner) where.ownerUserId = filterOwner;
  if (filterSource) where.source = filterSource;
  if (filterAge > 0)
    where.updatedAt = { lt: new Date(now.getTime() - filterAge * 24 * 60 * 60 * 1000) };

  const [leads, cities, operators] = await Promise.all([
    db.outreachLead.findMany({
      where,
      include: {
        city: { select: { name: true } },
        community: { select: { name: true } },
        _count: { select: { notes: true } },
      },
      orderBy: [{ stage: 'asc' }, { nextActionAt: 'asc' }, { createdAt: 'desc' }],
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Operators eligible for assignment: all role assignments with operator roles
    db.user.findMany({
      where: {
        roleAssignments: {
          some: {
            revokedAt: null,
            role: { in: ['OPS_LEAD', 'PARTNERSHIPS_LEAD', 'CITY_AMBASSADOR', 'PLATFORM_ADMIN'] },
          },
        },
      },
      select: { id: true, displayName: true, email: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  // Per-stage counts for header
  const stageCounts = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, leads.filter((l) => l.stage === s).length]),
  );

  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outreach CRM</h1>
          <p className="text-muted mt-1 text-sm">
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stage funnel summary */}
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((s) => (
            <div key={s} className="text-center">
              <p className="text-lg font-bold">{stageCounts[s]}</p>
              <p className="text-muted text-[10px]">{s.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-6 flex flex-wrap gap-3">
        <select
          name="city"
          defaultValue={filterCity}
          className="border-border rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="owner"
          defaultValue={filterOwner}
          className="border-border rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All owners</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.displayName ?? op.email}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={filterSource}
          className="border-border rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          {['manual', 'ambassador', 'pipeline', 'partner'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="age"
          defaultValue={filterAge.toString()}
          className="border-border rounded-lg border px-3 py-2 text-sm"
        >
          <option value="0">Any age</option>
          <option value="14">Stale &gt;14d</option>
          <option value="30">Stale &gt;30d</option>
        </select>
        <button
          type="submit"
          className="border-border rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Filter
        </button>
        {(filterCity || filterOwner || filterSource || filterAge > 0) && (
          <Link
            href="/admin/outreach"
            className="text-muted rounded-lg px-4 py-2 text-sm hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Kanban */}
      {leads.length === 0 ? (
        <div className="border-border rounded-[var(--radius-card)] border border-dashed py-16 text-center">
          <p className="text-muted text-sm">No leads yet - add your first lead below.</p>
        </div>
      ) : (
        <OutreachKanban leads={leads} showCityBadge={!filterCity} />
      )}

      {/* Create lead panel */}
      <details className="mt-10">
        <summary className="cursor-pointer text-sm font-semibold hover:underline">
          + Add lead
        </summary>
        <div className="border-border mt-4 max-w-lg rounded-[var(--radius-card)] border p-6">
          <CreateLeadForm cities={cities} operators={operators} currentUserId={''} />
        </div>
      </details>
    </div>
  );
}
