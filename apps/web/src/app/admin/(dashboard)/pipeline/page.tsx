import Link from 'next/link';
import { db } from '@/lib/db';
import { getSourceReliabilityStats } from '@/modules/pipeline';
import { getRuntimeEnabledRegions } from '@/modules/pipeline/config/runtime-config';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { parseOffsetPagination, buildOffsetPaginationMeta, buildPageHref } from '@/lib/pagination';
import { PaginationControls } from '@/components/ui/PaginationControls';
import RunPipelineButton from './RunPipelineButton';
import { StatusPill } from './StatusPill';
import { PipelineItemCard } from './PipelineItemCard';
import { OperationsPasses } from './OperationsPasses';
import { KeywordSuggestionList } from './KeywordSuggestionList';
import { SourceReliabilityPanel } from './SourceReliabilityPanel';
import { PipelineRunHistory } from './PipelineRunHistory';
import { ProcessedActivity } from './ProcessedActivity';

export const metadata = { title: 'Content Pipeline - Admin' };

const ENTITY_FILTERS = ['ALL', 'COMMUNITY', 'EVENT', 'RESOURCE'] as const;

export default async function AdminPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawEntityFilter = (sp.entityType as string | undefined)?.toUpperCase();
  const entityTypeFilter = ENTITY_FILTERS.includes(
    rawEntityFilter as (typeof ENTITY_FILTERS)[number],
  )
    ? (rawEntityFilter as (typeof ENTITY_FILTERS)[number])
    : 'ALL';

  const regions = await getRuntimeEnabledRegions();
  const enabledCitySlugs = Array.from(new Set(regions.flatMap((region) => region.citySlugs)));
  const enabledCities = await db.city.findMany({
    where: { slug: { in: enabledCitySlugs } },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  const sourceStats = await getSourceReliabilityStats();
  const llmAuditSince = new Date();
  llmAuditSince.setDate(llmAuditSince.getDate() - 7);

  // Pagination for the review queue
  const { page, pageSize, skip, take } = parseOffsetPagination(sp, {
    defaultPageSize: 5,
    maxPageSize: 100,
  });
  const pendingWhere =
    entityTypeFilter === 'ALL'
      ? {
          status: 'PENDING' as const,
          NOT: {
            AND: [{ sourceType: 'EVENT_SUGGESTION' as const }, { createdEntityId: { not: null } }],
          },
        }
      : {
          status: 'PENDING' as const,
          entityType: entityTypeFilter,
          NOT: {
            AND: [{ sourceType: 'EVENT_SUGGESTION' as const }, { createdEntityId: { not: null } }],
          },
        };
  const [items, totalCount] = await Promise.all([
    db.pipelineItem.findMany({
      where: pendingWhere,
      include: { city: { select: { name: true, slug: true } } },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    db.pipelineItem.count({ where: pendingWhere }),
  ]);

  const autoApprovedItems = await db.pipelineItem.findMany({
    where: { autoApproved: true, status: 'APPROVED' },
    include: { city: { select: { name: true } } },
    orderBy: { reviewedAt: 'desc' },
    take: 10,
  });

  const keywordSuggestions = await db.keywordSuggestion.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    take: 12,
  });

  const highConfidence = items.filter((i: (typeof items)[number]) => i.confidence >= 0.85);

  const recentlyProcessed = await db.pipelineItem.findMany({
    where: { status: { in: ['APPROVED', 'REJECTED', 'MERGED'] } },
    include: { city: { select: { name: true } } },
    orderBy: { reviewedAt: 'desc' },
    take: 10,
  });

  const [recentRuns, llmAuditRows] = await Promise.all([
    db.pipelineRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        triggeredBy: true,
        scopeRegionIds: true,
        scopeCitySlugs: true,
        itemsQueued: true,
        llmCalls: true,
        llmTokensEstimate: true,
        durationMs: true,
        laneBreakdown: true,
      },
    }),
    db.pipelineLlmCall.groupBy({
      by: ['lane', 'ok'],
      where: { createdAt: { gte: llmAuditSince } },
      _count: { _all: true },
      _sum: { totalTokens: true, durationMs: true },
    }),
  ]);

  const llmAuditByLane = llmAuditRows.reduce<
    Record<string, { calls: number; failedCalls: number; tokens: number; durationMs: number }>
  >((acc, row) => {
    const lane = row.lane ?? 'UNSPECIFIED';
    const current = acc[lane] ?? { calls: 0, failedCalls: 0, tokens: 0, durationMs: 0 };
    current.calls += row._count._all;
    current.tokens += row._sum.totalTokens ?? 0;
    current.durationMs += row._sum.durationMs ?? 0;
    if (!row.ok) current.failedCalls += row._count._all;
    acc[lane] = current;
    return acc;
  }, {});

  type EnabledCityRow = (typeof enabledCities)[number];

  const paginationMeta = buildOffsetPaginationMeta({
    page,
    pageSize,
    totalCount,
    itemCount: items.length,
  });

  const getPageHref = (targetPage: number) =>
    buildPageHref({
      page: targetPage,
      searchParams: { ...sp, page: String(targetPage), pageSize: String(pageSize) },
    });

  const diagnosticsSummary = [
    keywordSuggestions.length > 0 ? `${keywordSuggestions.length} keyword suggestions` : null,
    sourceStats.length > 0 ? `${sourceStats.length} sources tracked` : null,
    recentRuns.length > 0 ? `${recentRuns.length} recent runs` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <AdminPage>
      <AdminPageHeader
        title="Content Pipeline"
        description="Run discovery, then clear the review queue. Diagnostics live below."
        backHref="/admin"
      />

      {/* ─── Stats + run action ─── */}
      <div className="flex flex-wrap items-start gap-4">
        <StatusPill label="Pending review" value={totalCount} />
        <StatusPill label="High confidence" value={highConfidence.length} />
        <StatusPill label="Keyword suggestions" value={keywordSuggestions.length} />
        <div className="w-full sm:ml-auto sm:w-auto">
          <RunPipelineButton
            regions={regions.map((region) => ({ id: region.id, label: region.label }))}
            cities={enabledCities.map((city: EnabledCityRow) => ({
              slug: city.slug,
              label: city.name,
            }))}
          />
        </div>
      </div>

      <p className="text-muted mt-3 text-xs leading-5">
        Event contributions that already created a pending event are reviewed in Admin Events to
        keep event moderation decisions in one queue.
      </p>

      {/* ─── Review queue (primary task) ─── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Review queue ({totalCount})</h2>
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ENTITY_FILTERS.map((filter) => (
            <Link
              key={filter}
              href={buildPageHref({
                page: 1,
                searchParams: { ...sp, entityType: filter === 'ALL' ? undefined : filter },
              })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                entityTypeFilter === filter
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filter === 'ALL' ? 'All types' : filter}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="text-muted mt-12 text-center">
            No items in the review queue. Run the pipeline to fetch new content.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {items.map((item: (typeof items)[number]) => (
              <PipelineItemCard key={item.id} item={item} />
            ))}
          </div>
        )}

        <div className="mt-4">
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>
      </section>

      {/* ─── Operations & diagnostics (collapsed by default) ─── */}
      <details className="card-base mt-10 [&_summary]:cursor-pointer">
        <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-lg font-semibold">Operations &amp; diagnostics</span>
          <span className="text-muted text-xs">
            {diagnosticsSummary || 'Manual passes, source reliability, run history'}
          </span>
        </summary>
        <div className="space-y-8 border-t border-slate-200 px-5 py-6">
          <OperationsPasses autoApprovedIds={autoApprovedItems.map((item) => item.id)} />
          <KeywordSuggestionList suggestions={keywordSuggestions} />
          <SourceReliabilityPanel stats={sourceStats} />
          <PipelineRunHistory runs={recentRuns} llmAuditByLane={llmAuditByLane} />
          <ProcessedActivity
            autoApproved={autoApprovedItems}
            recentlyProcessed={recentlyProcessed}
          />
        </div>
      </details>
    </AdminPage>
  );
}
