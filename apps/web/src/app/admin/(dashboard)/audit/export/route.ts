import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import type { ContentLogAction } from '@prisma/client';

const MAX_EXPORT_ROWS = 10_000;

export async function GET(request: NextRequest) {
  // CSV export is founder-only (PRD-0018 §4). audit.read is granted to OPS_LEAD
  // and PARTNERSHIPS_LEAD too, but export access is intentionally tighter.
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const filterEntityType = sp.get('entityType') ?? '';
  const filterEntityId = sp.get('entityId') ?? '';
  const filterAction = sp.get('action') ?? '';
  const filterChangedBy = sp.get('changedBy') ?? '';
  const filterFrom = sp.get('from') ?? '';
  const filterTo = sp.get('to') ?? '';

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
      const toDate = new Date(filterTo);
      toDate.setDate(toDate.getDate() + 1);
      where.createdAt.lte = toDate;
    }
  }

  const logs = await db.contentLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });

  // Build CSV
  const header = ['id', 'entityType', 'entityId', 'action', 'changedBy', 'createdAt', 'metadata'];
  const rows = logs.map((log) => [
    log.id,
    log.entityType,
    log.entityId,
    log.action,
    log.changedBy ?? '',
    log.createdAt.toISOString(),
    log.metadata ? JSON.stringify(log.metadata) : '',
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape fields containing comma, quote, or newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(','),
    )
    .join('\n');

  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
