import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { resources as resourceContract } from '@indlokal/shared';
import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { deleteResourceAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmSubmitButton } from '@/components/ui';
import { ResourceJourneyTagEditor } from '@/components/admin/JourneyTagEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resources - Admin' };

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    type?: string;
    q?: string;
    gap?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp);
  const types = resourceContract.ResourceType.options;

  const where: Prisma.ResourceWhereInput = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.type && types.includes(sp.type as (typeof types)[number])) {
    where.resourceType = sp.type as (typeof types)[number];
  }
  if (sp.q) where.title = { contains: sp.q, mode: 'insensitive' };
  // Journey-coverage backfill worklists (PRD/TDD-0053).
  if (sp.gap === 'untagged') {
    where.OR = [{ audiences: { isEmpty: true } }, { lifecycleStage: { isEmpty: true } }];
  } else if (sp.gap === 'audience') {
    where.audiences = { isEmpty: true };
  } else if (sp.gap === 'stage') {
    where.lifecycleStage = { isEmpty: true };
  }

  const [totalCount, resources, cities] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
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

  function governanceSummary(metadata: Prisma.JsonValue | null): {
    mode: 'OWNED' | 'CURATED';
    riskClass: string | null;
  } {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { mode: 'CURATED', riskClass: null };
    }
    const obj = metadata as Record<string, unknown>;
    const mode = obj.contentMode === 'OWNED' ? 'OWNED' : 'CURATED';
    const governance =
      obj.governance && typeof obj.governance === 'object' && !Array.isArray(obj.governance)
        ? (obj.governance as Record<string, unknown>)
        : null;
    const riskClass =
      governance && typeof governance.riskClass === 'string' ? governance.riskClass : null;
    return { mode, riskClass };
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Resources"
        backHref="/admin/data"
        backLabel="Data"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/data/resources/reverification"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reverification queue
            </Link>
            <Link
              href="/admin/data/resources/new"
              className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              New resource
            </Link>
          </div>
        }
      />

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
          <AdminFilterItem label="Journey gap">
            <select
              name="gap"
              defaultValue={sp.gap ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All resources</option>
              <option value="untagged">Untagged (no audience or stage)</option>
              <option value="audience">Missing audience</option>
              <option value="stage">Missing lifecycle stage</option>
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
              <AdminTh>Journey tags</AdminTh>
              <AdminTh>Governance</AdminTh>
              <AdminTh>URL</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {resources.map((r) => {
              const gov = governanceSummary(r.metadata as Prisma.JsonValue | null);
              return (
                <tr key={r.id} className="border-border border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-muted font-mono text-xs">{r.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.resourceType}</td>
                  <td className="px-3 py-2 text-xs">{r.city?.name ?? '-'}</td>
                  <td className="px-3 py-2 align-top">
                    <ResourceJourneyTagEditor
                      id={r.id}
                      audiences={r.audiences}
                      lifecycleStage={r.lifecycleStage}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        gov.mode === 'OWNED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {gov.mode}
                    </span>
                    {gov.riskClass ? (
                      <div className="text-muted mt-1 text-[11px]">risk: {gov.riskClass}</div>
                    ) : null}
                  </td>
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
                    <Link
                      href={`/admin/data/resources/${r.id}`}
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                    >
                      edit
                    </Link>
                    <form action={deleteResourceAction} className="ml-3 inline-block">
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmitButton
                        triggerLabel="delete"
                        title="Delete this resource permanently?"
                        description="This action permanently removes the resource record."
                        confirmLabel="Delete resource"
                        tone="danger"
                        triggerClassName="text-xs text-red-600 hover:underline"
                      />
                    </form>
                  </td>
                </tr>
              );
            })}
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
