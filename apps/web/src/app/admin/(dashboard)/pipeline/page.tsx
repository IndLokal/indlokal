import { db } from '@/lib/db';
import Link from 'next/link';
import type { PipelineLaneBreakdown, PipelineLaneMetricKey } from '@/modules/pipeline/types';
import {
  approveKeywordSuggestion,
  approvePipelineItem,
  rejectKeywordSuggestion,
  rejectPipelineItem,
  revertAutoApprovedItems,
  runEnrichmentPass,
  runKeywordExpansionPass,
  runRelationshipInference,
} from './actions';
import RunPipelineButton from './RunPipelineButton';
import { getSourceReliabilityStats } from '@/modules/pipeline';
import { getRuntimeEnabledRegions } from '@/modules/pipeline/config/runtime-config';
import type { ExtractedEvent, ExtractedCommunity, ExtractedResource } from '@/modules/pipeline';
import { assessResourceApprovalEligibility } from '@/modules/pipeline/review';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { parseOffsetPagination, buildOffsetPaginationMeta, buildPageHref } from '@/lib/pagination';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmSubmitButton } from '@/components/ui';

export const metadata = { title: 'Content Pipeline - Admin' };

const ENTITY_FILTERS = ['ALL', 'COMMUNITY', 'EVENT', 'RESOURCE'] as const;
const KEYWORD_SUGGESTION_LANES = ['EVENT', 'COMMUNITY', 'RESOURCE'] as const;
const EVENT_REJECTION_REASONS = [
  'POLICY_VIOLATION',
  'UNVERIFIABLE',
  'DUPLICATE',
  'SPAM',
  'OUTSIDE_COVERAGE',
] as const;
const RUN_LANE_KEYS = ['EVENT', 'COMMUNITY', 'RESOURCE', 'UNKNOWN'] as const;

function formatResourceApprovalReason(reason: string): string {
  switch (reason) {
    case 'resource-approval-requires-public-url':
      return 'Approval needs a public source URL.';
    case 'resource-url-is-not-public-evidence':
      return 'The source URL is not valid public evidence.';
    case 'resource-approval-requires-official-or-institutional-domain':
      return 'Approval is limited to official registry, government, or institutional domains.';
    default:
      return 'This resource needs manual source-policy review.';
  }
}

function emptyLaneMetrics() {
  return {
    fetched: 0,
    passedFilter: 0,
    extracted: 0,
    queued: 0,
    duplicates: 0,
    noCity: 0,
    past: 0,
    cityConflicts: 0,
  };
}

function normalizeLaneBreakdown(value: unknown): PipelineLaneBreakdown {
  const fallback: PipelineLaneBreakdown = {
    EVENT: emptyLaneMetrics(),
    COMMUNITY: emptyLaneMetrics(),
    RESOURCE: emptyLaneMetrics(),
    UNKNOWN: emptyLaneMetrics(),
  };

  if (!value || typeof value !== 'object') return fallback;

  for (const lane of RUN_LANE_KEYS) {
    const record = (value as Record<string, unknown>)[lane];
    if (!record || typeof record !== 'object') continue;
    fallback[lane] = {
      fetched: Number((record as Record<string, unknown>).fetched ?? 0),
      passedFilter: Number((record as Record<string, unknown>).passedFilter ?? 0),
      extracted: Number((record as Record<string, unknown>).extracted ?? 0),
      queued: Number((record as Record<string, unknown>).queued ?? 0),
      duplicates: Number((record as Record<string, unknown>).duplicates ?? 0),
      noCity: Number((record as Record<string, unknown>).noCity ?? 0),
      past: Number((record as Record<string, unknown>).past ?? 0),
      cityConflicts: Number((record as Record<string, unknown>).cityConflicts ?? 0),
    };
  }

  return fallback;
}

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
  const llmAuditSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Pagination for pipeline items
  const { page, pageSize, skip, take } = parseOffsetPagination(sp, {
    defaultPageSize: 25,
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

  // Type aliases for rendering
  type EnabledCityRow = (typeof enabledCities)[number];
  type PendingPipelineItem = (typeof items)[number];
  type AutoApprovedItem = (typeof autoApprovedItems)[number];
  type KeywordSuggestionRow = (typeof keywordSuggestions)[number];
  type ProcessedItem = (typeof recentlyProcessed)[number];
  type RecentRunRow = (typeof recentRuns)[number];

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

  return (
    <AdminPage>
      <AdminPageHeader
        title="Content Pipeline"
        description="Run discovery, review extracted content, and manage approval workflow."
        backHref="/admin"
      />

      <div className="card-base p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
                Operations Console
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {regions.length} enabled regions
              </span>
            </div>
            <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
              Regional runs mirror cron shards to make debugging and source quality review easier.
            </p>
            <p className="text-muted mt-1 max-w-2xl text-xs leading-5">
              Event contributions that already created a pending event are reviewed in Admin Events
              to keep event moderation decisions in one queue.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <StatusPill label="Pending review" value={items.length} />
              <StatusPill label="High confidence" value={highConfidence.length} />
              <StatusPill label="Keyword suggestions" value={keywordSuggestions.length} />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <RunPipelineButton
              regions={regions.map((region) => ({ id: region.id, label: region.label }))}
              cities={enabledCities.map((city: EnabledCityRow) => ({
                slug: city.slug,
                label: city.name,
              }))}
            />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-muted text-xs">
            Review queue and source quality update automatically after each manual run.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
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
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <form action={runEnrichmentPass} className="card-base p-4">
          <h2 className="font-semibold">Enrichment</h2>
          <p className="text-muted mt-1 text-sm">Queue sparse-community enrichment suggestions.</p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Run Enrichment
          </button>
        </form>
        <form action={runRelationshipInference} className="card-base p-4">
          <h2 className="font-semibold">Relationships</h2>
          <p className="text-muted mt-1 text-sm">Infer same-organizer and sister-chapter edges.</p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Infer Relationships
          </button>
        </form>
        <form action={runKeywordExpansionPass} className="card-base p-4">
          <h2 className="font-semibold">Keywords</h2>
          <p className="text-muted mt-1 text-sm">
            Generate new search keyword suggestions from approved items.
          </p>
          <button type="submit" className="btn-secondary mt-4 w-full">
            Generate Keywords
          </button>
        </form>
        {autoApprovedItems.length > 0 && (
          <form action={revertAutoApprovedItems} className="card-base p-4">
            <h2 className="font-semibold">Auto-Approve</h2>
            <p className="text-muted mt-1 text-sm">
              Revert the latest auto-approved items back into review.
            </p>
            <input
              type="hidden"
              name="ids"
              value={autoApprovedItems.map((item: AutoApprovedItem) => item.id).join(',')}
            />
            <div className="mt-4">
              <ConfirmSubmitButton
                triggerLabel="Revert Recent Auto-Approvals"
                title="Revert recent auto-approvals?"
                description="The selected auto-approved items will be moved back to pending review."
                confirmLabel="Revert approvals"
                tone="danger"
                triggerClassName="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              />
            </div>
          </form>
        )}
      </section>

      {sourceStats.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Source Reliability</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourceStats.map((stat) => (
              <div key={stat.key} className="card-base p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{stat.sourceType}</h3>
                    <p className="text-muted mt-0.5 text-xs">Lane: {stat.lane}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      stat.confidenceAdjustment > 0
                        ? 'bg-green-100 text-green-700'
                        : stat.confidenceAdjustment < 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {stat.confidenceAdjustment > 0
                      ? `+${Math.round(stat.confidenceAdjustment * 100)}%`
                      : `${Math.round(stat.confidenceAdjustment * 100)}%`}
                  </span>
                </div>
                <p className="text-muted mt-2 text-sm">
                  Approval rate: {Math.round(stat.approvalRate * 100)}% · Reviewed:{' '}
                  {stat.totalReviewed}
                </p>
                <p className="text-muted mt-1 text-xs">
                  Approved {stat.approved} · Rejected {stat.rejected} · Pending {stat.pending} ·
                  Merged {stat.merged}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(recentRuns.length > 0 || Object.keys(llmAuditByLane).length > 0) && (
        <section className="mt-8 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          {recentRuns.length > 0 && (
            <div className="card-base p-4">
              <h2 className="text-lg font-semibold">Recent Pipeline Runs</h2>
              <p className="text-muted mt-1 text-sm">
                Persisted lane history from the last 8 runs.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-1 font-medium">When</th>
                      <th className="px-2 py-1 font-medium">Scope</th>
                      <th className="px-2 py-1 font-medium">Queued</th>
                      <th className="px-2 py-1 font-medium">Tokens</th>
                      <th className="px-2 py-1 font-medium">Duration</th>
                      <th className="px-2 py-1 font-medium">Lane summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run: RecentRunRow) => {
                      const laneBreakdown = normalizeLaneBreakdown(run.laneBreakdown);
                      const scopeLabel =
                        run.scopeCitySlugs.length > 0
                          ? `Cities: ${run.scopeCitySlugs.join(', ')}`
                          : run.scopeRegionIds.length > 0
                            ? `Regions: ${run.scopeRegionIds.join(', ')}`
                            : 'All enabled';
                      return (
                        <tr
                          key={run.id}
                          className="border-t border-slate-100 align-top text-slate-700"
                        >
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <div>{run.createdAt.toLocaleDateString()}</div>
                            <div className="text-muted text-[11px]">{run.triggeredBy}</div>
                          </td>
                          <td className="px-2 py-1.5">{scopeLabel}</td>
                          <td className="px-2 py-1.5">{run.itemsQueued}</td>
                          <td className="px-2 py-1.5">~{run.llmTokensEstimate}</td>
                          <td className="px-2 py-1.5">{(run.durationMs / 1000).toFixed(1)}s</td>
                          <td className="px-2 py-1.5">
                            <div>
                              E {laneBreakdown.EVENT.queued}q / {laneBreakdown.EVENT.cityConflicts}c
                            </div>
                            <div>
                              C {laneBreakdown.COMMUNITY.queued}q /{' '}
                              {laneBreakdown.COMMUNITY.cityConflicts}c
                            </div>
                            <div>
                              R {laneBreakdown.RESOURCE.queued}q /{' '}
                              {laneBreakdown.RESOURCE.cityConflicts}c
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Object.keys(llmAuditByLane).length > 0 && (
            <div className="card-base p-4">
              <h2 className="text-lg font-semibold">LLM Audit by Lane</h2>
              <p className="text-muted mt-1 text-sm">Last 7 days of persisted LLM calls.</p>
              <div className="mt-4 space-y-3">
                {Object.entries(llmAuditByLane)
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([lane, stats]) => (
                    <div
                      key={lane}
                      className="rounded-[var(--radius-button)] border border-slate-200 bg-white px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">{lane}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {stats.calls} calls
                        </span>
                      </div>
                      <div className="text-muted mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>Tokens: ~{stats.tokens}</div>
                        <div>Duration: {(stats.durationMs / 1000).toFixed(1)}s</div>
                        <div>Failures: {stats.failedCalls}</div>
                        <div>
                          Avg tokens/call:{' '}
                          {stats.calls > 0 ? Math.round(stats.tokens / stats.calls) : 0}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {keywordSuggestions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Keyword Suggestions</h2>
          <div className="mt-4 space-y-3">
            {keywordSuggestions.map((suggestion: KeywordSuggestionRow) => (
              <div
                key={suggestion.id}
                className="card-base flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{suggestion.keyword}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {suggestion.lane ?? 'UNSET'}
                    </span>
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    Seen in {suggestion.sourceCount} approved items
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveKeywordSuggestion}>
                    <input type="hidden" name="id" value={suggestion.id} />
                    <label className="sr-only" htmlFor={`lane-${suggestion.id}`}>
                      Lane
                    </label>
                    <select
                      id={`lane-${suggestion.id}`}
                      name="lane"
                      defaultValue={suggestion.lane ?? ''}
                      className="mr-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
                    >
                      <option value="" disabled>
                        Select lane
                      </option>
                      {KEYWORD_SUGGESTION_LANES.map((lane) => (
                        <option key={lane} value={lane}>
                          {lane}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectKeywordSuggestion}>
                    <input type="hidden" name="id" value={suggestion.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {autoApprovedItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-sky-700">Auto-Approved</h2>
          <div className="mt-4 space-y-2">
            {autoApprovedItems.map((item: AutoApprovedItem) => {
              const data = item.extractedData as unknown as
                | ExtractedEvent
                | ExtractedCommunity
                | ExtractedResource;
              const name =
                data.type === 'EVENT'
                  ? data.title
                  : data.type === 'COMMUNITY'
                    ? data.name
                    : data.title;
              return (
                <div
                  key={item.id}
                  className="border-border/50 flex items-center justify-between rounded-[var(--radius-button)] border px-4 py-2 text-sm"
                >
                  <div>
                    <span className="text-sky-600">⚡</span>{' '}
                    <span className="font-medium">{name}</span>
                    <span className="text-muted ml-2">
                      {item.entityType} · {item.city.name}
                    </span>
                    {item.autoApprovalReason && (
                      <span className="text-muted ml-2 text-xs">({item.autoApprovalReason})</span>
                    )}
                  </div>
                  <span className="text-muted text-xs">
                    {item.reviewedAt?.toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Paginated review queue ─── */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-green-700">Review Queue ({totalCount})</h2>
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>
        {items.length === 0 ? (
          <p className="text-muted mt-12 text-center">
            No items in the review queue. Run the pipeline to fetch new content.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item: PendingPipelineItem) => (
              <PipelineItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
        <div className="mt-4">
          <PaginationControls meta={paginationMeta} getPageHref={getPageHref} />
        </div>
      </section>

      {/* ─── Recent history ─── */}
      {recentlyProcessed.length > 0 && (
        <section className="mt-12">
          <h2 className="text-muted text-lg font-semibold">Recently Processed</h2>
          <div className="mt-4 space-y-2">
            {recentlyProcessed.map((item: ProcessedItem) => {
              const data = item.extractedData as unknown as
                | ExtractedEvent
                | ExtractedCommunity
                | ExtractedResource;
              const name =
                data.type === 'EVENT'
                  ? (data as ExtractedEvent).title
                  : data.type === 'COMMUNITY'
                    ? (data as ExtractedCommunity).name
                    : (data as ExtractedResource).title;
              return (
                <div
                  key={item.id}
                  className="border-border/50 flex items-center justify-between rounded-[var(--radius-button)] border px-4 py-2 text-sm"
                >
                  <div>
                    <span
                      className={item.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}
                    >
                      {item.status === 'APPROVED' ? '✓' : '✗'}
                    </span>{' '}
                    <span className="font-medium">{name}</span>
                    <span className="text-muted ml-2">
                      {item.entityType} · {item.city.name}
                    </span>
                  </div>
                  <span className="text-muted text-xs">
                    {item.reviewedAt?.toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminPage>
  );
}

function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// ─── Pipeline item card component ──────────────────────

type PipelineItemWithCity = Awaited<
  ReturnType<
    typeof db.pipelineItem.findMany<{ include: { city: { select: { name: true; slug: true } } } }>
  >
>[number];

function getCalendarSourceMeta(sourceUrl: string | null): {
  calendarId: string;
  feedOrigin: string;
} | null {
  if (!sourceUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (parsed.hostname !== 'calendar.google.com') return null;
  if (!parsed.pathname.startsWith('/calendar/ical/')) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  const icalIndex = segments.indexOf('ical');
  const encodedCalendarId = icalIndex >= 0 ? segments[icalIndex + 1] : null;
  if (!encodedCalendarId) return null;

  const calendarId = decodeURIComponent(encodedCalendarId);
  const feedOrigin = `${parsed.origin}${parsed.pathname}`;

  return { calendarId, feedOrigin };
}

function PipelineItemCard({ item }: { item: PipelineItemWithCity }) {
  const data = item.extractedData as unknown as
    | ExtractedEvent
    | ExtractedCommunity
    | ExtractedResource;
  const isEvent = data.type === 'EVENT';
  const isCommunity = data.type === 'COMMUNITY';
  const isResource = data.type === 'RESOURCE';
  const event = isEvent ? (data as ExtractedEvent) : null;
  const community = isCommunity ? (data as ExtractedCommunity) : null;
  const resource = isResource ? (data as ExtractedResource) : null;
  const calendarSource = isEvent ? getCalendarSourceMeta(item.sourceUrl) : null;
  const resourceApproval = resource
    ? assessResourceApprovalEligibility({ resource, sourceUrl: item.sourceUrl })
    : null;
  const resourceApprovalHint =
    resourceApproval && !resourceApproval.eligible
      ? formatResourceApprovalReason(resourceApproval.reason)
      : null;
  const resourceRejectionSuggestion = resourceApprovalHint
    ? `UNVERIFIABLE: ${resourceApprovalHint}`
    : '';

  const confidenceColor =
    item.confidence >= 0.85
      ? 'bg-green-100 text-green-800'
      : item.confidence >= 0.6
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title + type badge */}
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                isEvent
                  ? 'bg-blue-100 text-blue-700'
                  : isCommunity
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {item.entityType}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              {item.reviewKind}
            </span>
            <h3 className="font-semibold">{event?.title ?? community?.name ?? resource?.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor}`}>
              {Math.round(item.confidence * 100)}%
            </span>
            {item.autoApproved && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                AUTO
              </span>
            )}
          </div>

          {/* Event details */}
          {event && (
            <div className="text-muted mt-1.5 space-y-0.5 text-sm">
              {event.date && (
                <p>
                  📅 {event.date}
                  {event.time && ` at ${event.time}`}
                  {event.endTime && ` - ${event.endTime}`}
                </p>
              )}
              {event.venueName && (
                <p>
                  📍 {event.venueName}
                  {event.venueAddress && ` · ${event.venueAddress}`}
                </p>
              )}
              {event.hostCommunity && <p>👥 {event.hostCommunity}</p>}
              <p>
                {event.costType === 'FREE'
                  ? '🆓 Free'
                  : event.costType === 'PAID'
                    ? `💰 ${event.cost ?? 'Paid'}`
                    : `❓ ${event.cost ?? 'Cost unclear'}`}
                {event.accessType &&
                  event.accessType !== 'UNCLEAR' &&
                  ` · ${event.accessType.replace(/_/g, ' ').toLowerCase()}`}
              </p>
            </div>
          )}

          {/* Community details */}
          {community && (
            <div className="text-muted mt-1.5 space-y-0.5 text-sm">
              {community.description && <p>{community.description}</p>}
              {community.languages.length > 0 && <p>🗣️ {community.languages.join(', ')}</p>}
            </div>
          )}

          {/* Resource details */}
          {resource && (
            <div className="text-muted mt-1.5 space-y-0.5 text-sm">
              {resource.description && <p>{resource.description}</p>}
              <p>📚 {resource.resourceType ?? 'COMMUNITY_RESOURCE'}</p>
              {resource.audiences.length > 0 && <p>🎯 {resource.audiences.join(', ')}</p>}
              {resource.lifecycleStage.length > 0 && <p>🧭 {resource.lifecycleStage.join(', ')}</p>}
              {resource.validUntil && <p>⏳ Valid until {resource.validUntil}</p>}
              {resource.isOfficialSource && <p>🏛️ Official source</p>}
              {resourceApprovalHint && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase">
                    Resource approval policy
                  </p>
                  <p className="mt-1 text-sm">{resourceApprovalHint}</p>
                </div>
              )}
              {resource.url && (
                <p>
                  🔗{' '}
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-500 hover:underline"
                  >
                    Open resource ↗
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Description */}
          {(event?.description ?? community?.description ?? resource?.description) && (
            <p className="text-muted mt-2 line-clamp-2 text-sm">
              {event?.description ?? community?.description ?? resource?.description}
            </p>
          )}

          {/* Categories */}
          {(event?.categories ?? community?.categories ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(event?.categories ?? community?.categories ?? []).map((cat) => (
                <span
                  key={cat}
                  className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Source info */}
          <p className="text-muted mt-2 text-xs">
            Source: {item.sourceType}
            {item.sourceUrl && (
              <>
                {' · '}
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:underline"
                >
                  View source ↗
                </a>
              </>
            )}
            {' · '}
            {item.city.name}
            {item.matchedEntityId && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                ⚠️ Possible duplicate (match: {Math.round((item.matchScore ?? 0) * 100)}%)
              </span>
            )}
            {item.reviewKind === 'ENRICHMENT' && item.targetEntityId && (
              <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                Suggestion for existing community
              </span>
            )}
          </p>
          {calendarSource && (
            <p className="text-muted mt-1 text-xs">
              Calendar ID: <span className="font-mono">{calendarSource.calendarId}</span>
              {' · '}
              Feed origin:{' '}
              <a
                href={calendarSource.feedOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:underline"
              >
                {calendarSource.feedOrigin}
              </a>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-2">
          <form action={approvePipelineItem}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              disabled={Boolean(resourceApprovalHint)}
              className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white ${
                resourceApprovalHint
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={resourceApprovalHint ?? undefined}
            >
              {resourceApprovalHint ? 'Approval blocked' : 'Approve'}
            </button>
          </form>
          <form action={rejectPipelineItem}>
            <input type="hidden" name="id" value={item.id} />
            {isEvent ? (
              <select
                name="reason"
                defaultValue="UNVERIFIABLE"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Event rejection reason"
              >
                {EVENT_REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="reason"
                defaultValue={resourceRejectionSuggestion}
                placeholder="Rejection reason"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
            <button
              type="submit"
              className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reject
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
