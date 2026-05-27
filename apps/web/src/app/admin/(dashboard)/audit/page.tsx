import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { AuditTable } from './AuditTable';
import type { ContentLogAction } from '@prisma/client';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { PaginationControls } from '@/components/ui/PaginationControls';

export const metadata = { title: 'Audit Log - Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const viewer = await requireCan('audit.read');
  // CSV export is founder-only (PRD-0018 §4)
  const canExport = viewer.role === 'PLATFORM_ADMIN';

  const sp = await searchParams;
  const filterEntityType = sp.entityType ?? '';
  const filterEntityId = sp.entityId ?? '';
  const filterAction = sp.action ?? '';
  const filterChangedBy = sp.changedBy ?? '';
  const filterFrom = sp.from ?? '';
  const filterTo = sp.to ?? '';
  const pagination = parseOffsetPagination(sp, { defaultPageSize: 50 });

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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
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

  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    itemCount: logs.length,
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Audit Log"
        description={`${totalCount.toLocaleString()} record${totalCount !== 1 ? 's' : ''}${Object.keys(where).length > 0 ? ' matching filters' : ' total'}`}
        actions={
          canExport ? (
            <a
              href={`/admin/audit/export?${new URLSearchParams({ entityType: filterEntityType, entityId: filterEntityId, action: filterAction, changedBy: filterChangedBy, from: filterFrom, to: filterTo }).toString()}`}
              className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Export CSV
            </a>
          ) : undefined
        }
      />

      <form method="GET" className="mt-6">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="Entity Type">
            <select
              name="entityType"
              defaultValue={filterEntityType}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All entity types</option>
              <option value="community">community</option>
              <option value="event">event</option>
              <option value="resource">resource</option>
              <option value="role_assignment">role_assignment</option>
              <option value="pipeline_item">pipeline_item</option>
              <option value="outreach_lead">outreach_lead</option>
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="Entity ID">
            <input
              name="entityId"
              defaultValue={filterEntityId}
              placeholder="Entity ID..."
              className="border-border w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </AdminFilterItem>
          <AdminFilterItem label="Action">
            <select
              name="action"
              defaultValue={filterAction}
              className="border-border w-full rounded border px-3 py-2 text-sm"
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
          </AdminFilterItem>
          <AdminFilterItem label="Changed By">
            <select
              name="changedBy"
              defaultValue={filterChangedBy}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All actors</option>
              <option value="system">system</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.displayName ?? op.email}
                </option>
              ))}
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="From">
            <input
              name="from"
              type="date"
              defaultValue={filterFrom}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            />
          </AdminFilterItem>
          <AdminFilterItem label="To">
            <input
              name="to"
              type="date"
              defaultValue={filterTo}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            />
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/audit" />
        </AdminFilterBar>
      </form>

      {/* Table + drawer */}
      <AuditTable logs={logs} operators={operators} />

      <PaginationControls
        className="mt-6"
        meta={paginationMeta}
        getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
      />
    </AdminPage>
  );
}
