import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  assignResourceReverificationAction,
  ingestResourceReverificationQueueAction,
  resolveResourceReverificationAction,
  setResourceReverificationSlaAction,
} from '../../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resource Reverification Queue - Admin' };

type SearchParams = {
  status?: string;
  owner?: string;
  overdue?: string;
  priority?: string;
};

function priorityBand(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

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

export default async function ReverificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const where: Prisma.ResourceReverificationQueueWhereInput = {};

  if (sp.status) {
    where.status = sp.status as Prisma.ResourceReverificationQueueWhereInput['status'];
  }
  if (sp.owner) {
    where.ownerUserId = sp.owner;
  }
  if (sp.overdue === 'true') {
    where.slaDueAt = { lt: now };
    where.status = { in: ['OPEN', 'ASSIGNED'] };
  }

  const [items, owners] = await Promise.all([
    db.resourceReverificationQueue.findMany({
      where,
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            slug: true,
            resourceType: true,
            city: { select: { name: true } },
          },
        },
        ownerUser: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: [{ priorityScore: 'desc' }, { slaDueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    db.user.findMany({
      where: {
        OR: [{ role: 'OPS_LEAD' }, { role: 'PLATFORM_ADMIN' }, { role: 'PARTNERSHIPS_LEAD' }],
      },
      select: { id: true, email: true, displayName: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  const filtered = sp.priority
    ? items.filter((item) => priorityBand(item.priorityScore) === sp.priority)
    : items;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Resource Reverification Queue"
        description={`${filtered.length} queue items`}
        backHref="/admin/data/resources"
        actions={
          <form action={ingestResourceReverificationQueueAction}>
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Run ingestion
            </button>
          </form>
        }
      />

      <form method="get" className="mt-6 grid gap-3 rounded-lg border p-3 md:grid-cols-4">
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
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
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
        <div className="flex items-center gap-3 md:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white"
          >
            Apply filters
          </button>
          <Link
            href="/admin/data/resources/reverification"
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
              <th className="px-3 py-2">Resource</th>
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
              const band = priorityBand(item.priorityScore);
              const tone = slaTone(item.slaDueAt);
              return (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.resource.title}</div>
                    <div className="text-muted text-xs">
                      {item.resource.resourceType} · {item.resource.city?.name ?? 'No city'}
                    </div>
                    <div className="text-muted font-mono text-xs">{item.resource.slug}</div>
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
                    <form
                      action={assignResourceReverificationAction}
                      className="flex flex-col gap-2"
                    >
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
                    <form
                      action={setResourceReverificationSlaAction}
                      className="flex flex-col gap-2"
                    >
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
                    <form
                      action={resolveResourceReverificationAction}
                      className="flex flex-col gap-2"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <select
                        name="resolutionAction"
                        className="border-border rounded border px-2 py-1 text-xs"
                        required
                      >
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="CORRECTED">CORRECTED</option>
                        <option value="HIDDEN">HIDDEN</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                        <option value="DISMISSED">DISMISSED</option>
                      </select>
                      <textarea
                        name="resolutionNotes"
                        rows={2}
                        className="border-border rounded border px-2 py-1 text-xs"
                        placeholder="Notes (required for hidden/archived)"
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
                  No queue items found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
