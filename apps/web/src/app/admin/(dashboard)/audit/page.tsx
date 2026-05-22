import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { AuditTable } from './AuditTable';
import type { ContentLogAction } from '@prisma/client';

export const metadata = { title: 'Audit Log — Admin' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCan('audit.read');

  const sp = await searchParams;
  const filterEntityType = sp.entityType ?? '';
  const filterEntityId = sp.entityId ?? '';
  const filterAction = sp.action ?? '';
  const filterChangedBy = sp.changedBy ?? '';
  const filterFrom = sp.from ?? '';
  const filterTo = sp.to ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (filterEntityType) where.entityType = filterEntityType;
  if (filterEntityId) where.entityId = filterEntityId;
  if (filterAction) where.action = filterAction as ContentLogAction;
  if (filterChangedBy) where.changedBy = filterChangedBy;
  if (filterFrom || filterTo) {
    where.createdAt = {};
    if (filterFrom) where.createdAt.gte = new Date(filterFrom);
    if (filterTo) {
      // include the full "to" day
      const toDate = new Date(filterTo);
      toDate.setDate(toDate.getDate() + 1);
      where.createdAt.lte = toDate;
    }
  }

  const [totalCount, logs, operators] = await Promise.all([
    db.contentLog.count({ where }),
    db.contentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Operators for changedBy picker (anyone who has ever written a log)
    db.user.findMany({
      where: {
        role: {
          in: ['PLATFORM_ADMIN', 'OPS_LEAD', 'PARTNERSHIPS_LEAD', 'CONTENT_EDITOR'],
        },
      },
      select: { id: true, email: true, displayName: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted mt-0.5 text-sm">
            {totalCount.toLocaleString()} record{totalCount !== 1 ? 's' : ''}
            {Object.keys(where).length > 0 ? ' matching filters' : ' total'}
          </p>
        </div>
        <a
          href={`/admin/audit/export?${new URLSearchParams({ entityType: filterEntityType, entityId: filterEntityId, action: filterAction, changedBy: filterChangedBy, from: filterFrom, to: filterTo }).toString()}`}
          className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <form method="GET" className="mt-6 flex flex-wrap gap-3">
        <select
          name="entityType"
          defaultValue={filterEntityType}
          className="border-border rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">All entity types</option>
          <option value="community">community</option>
          <option value="event">event</option>
          <option value="resource">resource</option>
          <option value="role_assignment">role_assignment</option>
          <option value="pipeline_item">pipeline_item</option>
          <option value="outreach_lead">outreach_lead</option>
        </select>

        <input
          name="entityId"
          defaultValue={filterEntityId}
          placeholder="Entity ID…"
          className="border-border w-40 rounded-lg border px-3 py-1.5 font-mono text-sm"
        />

        <select
          name="action"
          defaultValue={filterAction}
          className="border-border rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">All actions</option>
          <option value="CREATED">CREATED</option>
          <option value="UPDATED">UPDATED</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="ARCHIVED">ARCHIVED</option>
          <option value="SCORE_REFRESHED">SCORE_REFRESHED</option>
          <option value="ROLE_GRANTED">ROLE_GRANTED</option>
          <option value="ROLE_REVOKED">ROLE_REVOKED</option>
        </select>

        <select
          name="changedBy"
          defaultValue={filterChangedBy}
          className="border-border rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">All actors</option>
          <option value="system">system</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.displayName ?? op.email}
            </option>
          ))}
        </select>

        <input
          name="from"
          type="date"
          defaultValue={filterFrom}
          className="border-border rounded-lg border px-3 py-1.5 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={filterTo}
          className="border-border rounded-lg border px-3 py-1.5 text-sm"
        />

        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors"
        >
          Filter
        </button>
        <a
          href="/admin/audit"
          className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          Clear
        </a>
      </form>

      {/* Table + drawer */}
      <AuditTable logs={logs} operators={operators} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?${new URLSearchParams({ entityType: filterEntityType, entityId: filterEntityId, action: filterAction, changedBy: filterChangedBy, from: filterFrom, to: filterTo, page: String(page - 1) }).toString()}`}
                className="border-border text-muted hover:text-foreground rounded-lg border px-3 py-1.5 transition-colors"
              >
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?${new URLSearchParams({ entityType: filterEntityType, entityId: filterEntityId, action: filterAction, changedBy: filterChangedBy, from: filterFrom, to: filterTo, page: String(page + 1) }).toString()}`}
                className="border-border text-muted hover:text-foreground rounded-lg border px-3 py-1.5 transition-colors"
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
