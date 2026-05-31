import Link from 'next/link';
import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { deleteCommunityAction, setCommunityStatusAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { PaginationControls } from '@/components/ui/PaginationControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Communities - Admin' };

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    status?: string;
    claimState?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp);
  const where: {
    city?: { slug: string };
    status?: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
    claimState?: 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
    name?: { contains: string; mode: 'insensitive' };
  } = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.status && ['ACTIVE', 'INACTIVE', 'UNVERIFIED'].includes(sp.status)) {
    where.status = sp.status as 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
  }
  if (sp.claimState && ['UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED'].includes(sp.claimState)) {
    where.claimState = sp.claimState as 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
  }
  if (sp.q) where.name = { contains: sp.q, mode: 'insensitive' };

  const [totalCount, communities, cities] = await Promise.all([
    db.community.count({ where }),
    db.community.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        city: { select: { name: true, slug: true } },
        _count: { select: { events: true, accessChannels: true } },
      },
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
    itemCount: communities.length,
  });

  return (
    <AdminPage>
      <AdminPageHeader title="Communities" backHref="/admin/data" backLabel="Data" />

      <form className="mt-6" method="get">
        <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="Search">
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="name..."
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
          <AdminFilterItem label="Lifecycle Status">
            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="Claim Status">
            <select
              name="claimState"
              defaultValue={sp.claimState ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Any claim state</option>
              <option value="UNCLAIMED">Unclaimed</option>
              <option value="CLAIM_PENDING">Claim pending</option>
              <option value="CLAIMED">Claimed</option>
            </select>
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/data/communities" />
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
              <AdminTh>Community</AdminTh>
              <AdminTh>City</AdminTh>
              <AdminTh>Lifecycle Status</AdminTh>
              <AdminTh>Claim Status</AdminTh>
              <AdminTh>Events</AdminTh>
              <AdminTh>Channels</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {communities.map((c) => (
              <tr key={c.id} className="border-border border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted font-mono text-xs">{c.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{c.city?.name ?? '-'}</td>
                <td className="px-3 py-2">
                  <form action={setCommunityStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <select
                      name="status"
                      defaultValue={c.status}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="UNVERIFIED">UNVERIFIED</option>
                    </select>
                    <button
                      type="submit"
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                    >
                      save
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-xs font-medium">{c.claimState}</td>
                <td className="px-3 py-2 text-xs">{c._count.events}</td>
                <td className="px-3 py-2 text-xs">{c._count.accessChannels}</td>
                <td className="px-3 py-2 text-right">
                  {c.city?.slug && (
                    <Link
                      href={`/${c.city.slug}/communities/${c.slug}`}
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                      target="_blank"
                    >
                      view ↗
                    </Link>
                  )}
                  <form action={deleteCommunityAction} className="ml-3 inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                      title="Permanently delete this community (use for true duplicates / spam only)"
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
