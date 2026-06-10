import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { resolveEvidenceReadout } from '@/lib/community-trust';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import {
  deleteCommunityAction,
  refreshCommunityEvidenceAction,
  setCommunityStatusAction,
} from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmSubmitButton } from '@/components/ui';
import { CommunityPersonaTagEditor } from '@/components/admin/JourneyTagEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Communities - Admin' };

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    status?: string;
    claimState?: string;
    evidence?: string;
    gap?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagination = parseOffsetPagination(sp);
  const where: Prisma.CommunityWhereInput = {};
  if (sp.city) where.city = { slug: sp.city };
  if (sp.status && ['ACTIVE', 'INACTIVE', 'UNVERIFIED'].includes(sp.status)) {
    where.status = sp.status as 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
  }
  if (sp.claimState && ['UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED'].includes(sp.claimState)) {
    where.claimState = sp.claimState as 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
  }
  if (sp.q) where.name = { contains: sp.q, mode: 'insensitive' };
  if (
    sp.evidence &&
    ['verified_candidate', 'source_supported', 'insufficient'].includes(sp.evidence)
  ) {
    where.metadata = {
      path: ['sourceEvidence', 'quality'],
      equals: sp.evidence,
    };
  }
  // Journey-coverage backfill worklist: communities with no persona segments
  // never surface in journey "find your people" blocks (PRD/TDD-0053).
  if (sp.gap === 'persona') where.personaSegments = { isEmpty: true };

  const [totalCount, communities, cities] = await Promise.all([
    db.community.count({ where }),
    db.community.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        city: { select: { name: true, slug: true } },
        accessChannels: { select: { url: true } },
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
          <AdminFilterItem label="Evidence quality">
            <select
              name="evidence"
              defaultValue={sp.evidence ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Any evidence</option>
              <option value="verified_candidate">Strong evidence</option>
              <option value="source_supported">Source-supported</option>
              <option value="insufficient">Insufficient</option>
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="Journey gap">
            <select
              name="gap"
              defaultValue={sp.gap ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All communities</option>
              <option value="persona">Missing persona segments</option>
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
              <AdminTh>Evidence</AdminTh>
              <AdminTh>Persona tags</AdminTh>
              <AdminTh>Events</AdminTh>
              <AdminTh>Channels</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {communities.map((c) => {
              const metadata = (c.metadata ?? {}) as Record<string, unknown>;
              const persistedEvidence = metadata.sourceEvidence as
                | {
                    quality?: 'verified_candidate' | 'source_supported' | 'insufficient';
                    strongestLabel?: string | null;
                    reason?: string;
                  }
                | undefined;
              const evidence = resolveEvidenceReadout({
                storedEvidence: persistedEvidence,
                sourceUrls: c.accessChannels.map((ch) => ch.url),
              });

              const evidenceTone =
                evidence.display.tone === 'strong'
                  ? 'bg-emerald-100 text-emerald-700'
                  : evidence.display.tone === 'supported'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700';

              return (
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
                  <td className="px-3 py-2 text-xs">
                    <span
                      title={`${evidence.reason}${evidence.strongestLabel ? ` (${evidence.strongestLabel})` : ''}`}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${evidenceTone}`}
                    >
                      {evidence.display.shortLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CommunityPersonaTagEditor
                      id={c.id}
                      personaSegments={c.personaSegments}
                      languages={c.languages}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">{c._count.events}</td>
                  <td className="px-3 py-2 text-xs">{c._count.accessChannels}</td>
                  <td className="px-3 py-2 text-right align-top">
                    {c.city?.slug && (
                      <Link
                        href={`/${c.city.slug}/communities/${c.slug}`}
                        className="text-brand-600 hover:text-brand-700 block text-xs hover:underline"
                        target="_blank"
                      >
                        view ↗
                      </Link>
                    )}
                    <form action={refreshCommunityEvidenceAction} className="mt-0.5">
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                      >
                        refresh evidence
                      </button>
                    </form>
                    <form action={deleteCommunityAction} className="mt-0.5">
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmitButton
                        triggerLabel="delete"
                        title="Delete this community permanently?"
                        description="This action permanently removes the community and related records. Use only for duplicates or spam."
                        confirmLabel="Delete community"
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
