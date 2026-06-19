import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db, resolveMetroScopeCityIds } from '@/lib/db';
import {
  assignJourneyGapBacklogAction,
  ingestJourneyGapBacklogAction,
  resolveJourneyGapBacklogAction,
  setJourneyGapBacklogSlaAction,
} from '../../actions';
import { priorityBandForJourneyGap } from '@/modules/journeys/ops-backlog';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

type SearchParams = {
  status?: string;
  owner?: string;
  overdue?: string;
  city?: string;
  priority?: string;
};

function slaTone(slaDueAt: Date | null): 'on-track' | 'due-today' | 'overdue' {
  if (!slaDueAt) return 'on-track';
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const due = slaDueAt.getTime();
  if (due < start) return 'overdue';
  if (due < end) return 'due-today';
  return 'on-track';
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journey Gap Backlog - Admin' };

export default async function JourneyGapBacklogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const scopedCityIds = sp.city ? await resolveMetroScopeCityIds(sp.city) : [];

  const where: Prisma.JourneyGapBacklogWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.JourneyGapBacklogWhereInput['status'];
  if (sp.owner) where.ownerUserId = sp.owner;
  if (sp.city) where.cityId = { in: scopedCityIds };
  if (sp.overdue === 'true') {
    where.slaDueAt = { lt: now };
    where.status = { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] };
  }

  const [items, owners, cities] = await Promise.all([
    db.journeyGapBacklog.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, slug: true } },
        ownerUser: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: [{ priorityScore: 'desc' }, { slaDueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 300,
    }),
    db.user.findMany({
      where: {
        OR: [{ role: 'OPS_LEAD' }, { role: 'PLATFORM_ADMIN' }, { role: 'PARTNERSHIPS_LEAD' }],
      },
      select: { id: true, email: true, displayName: true },
      orderBy: { email: 'asc' },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const filtered = sp.priority
    ? items.filter((item) => priorityBandForJourneyGap(item.priorityScore) === sp.priority)
    : items;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Journey Supply Backlog"
        description={`${filtered.length} rows (open + closed) from journey coverage gaps`}
        backHref="/admin/data/journeys"
        actions={
          <form action={ingestJourneyGapBacklogAction}>
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Generate backlog
            </button>
          </form>
        }
      />

      <form method="get" className="mt-6 grid gap-3 rounded-lg border p-3 md:grid-cols-5">
        <label className="text-sm">
          <span className="text-muted">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="border-border mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">City</span>
          <select
            name="city"
            defaultValue={sp.city ?? ''}
            className="border-border mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">All</option>
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Owner</span>
          <select
            name="owner"
            defaultValue={sp.owner ?? ''}
            className="border-border mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">All</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName ?? owner.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Priority</span>
          <select
            name="priority"
            defaultValue={sp.priority ?? ''}
            className="border-border mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">All</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Overdue</span>
          <select
            name="overdue"
            defaultValue={sp.overdue ?? ''}
            className="border-border mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">All</option>
            <option value="true">Overdue only</option>
          </select>
        </label>
        <div className="flex items-center gap-3 md:col-span-5">
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white"
          >
            Apply filters
          </button>
          <Link
            href="/admin/data/journeys/backlog"
            className="text-sm text-slate-600 hover:underline"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2">Gap</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Assign</th>
              <th className="px-3 py-2">Update SLA</th>
              <th className="px-3 py-2">Resolve</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const band = priorityBandForJourneyGap(item.priorityScore);
              const tone = slaTone(item.slaDueAt);
              return (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {item.city.name} · {item.personaLabel}
                    </div>
                    <div className="text-muted text-xs">{item.stage}</div>
                    <div className="text-muted text-xs">{item.gapSummary}</div>
                  </td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{item.priorityScore}</div>
                    <div className="text-muted text-xs">{band}</div>
                  </td>
                  <td className="px-3 py-2">
                    {item.slaDueAt ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          tone === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : tone === 'due-today'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.slaDueAt.toISOString().slice(0, 10)} ({tone})
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {item.ownerUser ? (item.ownerUser.displayName ?? item.ownerUser.email) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <form action={assignJourneyGapBacklogAction} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <select
                        name="ownerUserId"
                        className="border-border rounded border px-2 py-1 text-xs"
                        required
                      >
                        <option value="">Select owner</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.displayName ?? owner.email}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      >
                        Assign
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={setJourneyGapBacklogSlaAction} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="date"
                        name="slaDueAt"
                        className="border-border rounded border px-2 py-1 text-xs"
                        defaultValue={item.slaDueAt ? item.slaDueAt.toISOString().slice(0, 10) : ''}
                        required
                      />
                      <button
                        type="submit"
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      >
                        Save SLA
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={resolveJourneyGapBacklogAction} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <select
                        name="resolutionStatus"
                        className="border-border rounded border px-2 py-1 text-xs"
                        required
                      >
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="DISMISSED">DISMISSED</option>
                      </select>
                      <textarea
                        name="resolutionNotes"
                        rows={2}
                        className="border-border rounded border px-2 py-1 text-xs"
                        placeholder="Optional notes"
                      />
                      <button
                        type="submit"
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      >
                        Resolve
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                  No journey-gap backlog rows found for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
