import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { deleteResourceAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { PaginationControls } from '@/components/ui/PaginationControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resources - Admin' };

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    type?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp);
  const where: {
    city?: { slug: string };
    resourceType?: string;
    title?: { contains: string; mode: 'insensitive' };
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.type) where.resourceType = sp.type;
  if (sp.q) where.title = { contains: sp.q, mode: 'insensitive' };

  const [totalCount, resources, cities] = await Promise.all([
    db.resource.count({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
    }),
    db.resource.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
      include: { city: { select: { name: true, slug: true } } },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    itemCount: resources.length,
  });

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
    <AdminPage>
      <AdminPageHeader title="Resources" backHref="/admin/data" backLabel="Data" />

      <form className="mt-6" method="get">
        <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="Search">
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="title..."
              className="border-border w-full rounded border px-3 py-2 text-sm"
            />
          </AdminFilterItem>
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
          <AdminFilterItem label="Type">
            <select
              name="type"
              defaultValue={sp.type ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Any type</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/data/resources" />
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
              <AdminTh>Type</AdminTh>
              <AdminTh>City</AdminTh>
              <AdminTh>URL</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-muted font-mono text-xs">{r.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.resourceType}</td>
                <td className="px-3 py-2 text-xs">{r.city?.name ?? '-'}</td>
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
