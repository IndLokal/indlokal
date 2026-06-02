import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { deleteEventAction, setEventStatusAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmSubmitButton } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Events - Admin' };

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; status?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp);
  const where: {
    city?: { slug: string };
    status?: 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.status && ['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED'].includes(sp.status)) {
    where.status = sp.status as 'UPCOMING' | 'ONGOING' | 'PAST' | 'CANCELLED';
  }

  const [totalCount, events, cities] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        city: { select: { name: true, slug: true } },
        community: { select: { name: true, slug: true } },
      },
    }),
    db.city.findMany({ where: { isActive: true }, select: { slug: true, name: true } }),
  ]);
  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    itemCount: events.length,
  });

  return (
    <AdminPage>
      <AdminPageHeader title="Events" backHref="/admin/data" backLabel="Data" />

      <form className="mt-6" method="get">
        <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="City">
            <select
              name="city"
              defaultValue={sp.city ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="Status">
            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Any status</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ONGOING">Ongoing</option>
              <option value="PAST">Past</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/data/events" />
        </AdminFilterBar>
      </form>

      <PaginationControls
        className="mt-4"
        meta={paginationMeta}
        getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
      />

      <AdminTableWrap className="mt-3">
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Title</AdminTh>
              <AdminTh>When</AdminTh>
              <AdminTh>City</AdminTh>
              <AdminTh>Community</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
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
                <td className="px-3 py-2 text-xs">{e.city?.name ?? '-'}</td>
                <td className="px-3 py-2 text-xs">{e.community?.name ?? '-'}</td>
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
                <td className="px-3 py-2 text-right">
                  <form action={deleteEventAction} className="inline-block">
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmSubmitButton
                      triggerLabel="delete"
                      title="Delete this event permanently?"
                      description="This action permanently removes the event record."
                      confirmLabel="Delete event"
                      tone="danger"
                      triggerClassName="text-xs text-red-600 hover:underline"
                    />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </AdminTableWrap>

      <PaginationControls
        className="mt-4"
        meta={paginationMeta}
        getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
      />
    </AdminPage>
  );
}
