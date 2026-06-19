import type { PipelineLaneBreakdown } from '@/modules/pipeline/types';

const RUN_LANE_KEYS = ['EVENT', 'COMMUNITY', 'RESOURCE', 'UNKNOWN'] as const;

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

type RecentRunRow = {
  id: string;
  createdAt: Date;
  triggeredBy: string;
  scopeRegionIds: string[];
  scopeCitySlugs: string[];
  itemsQueued: number;
  llmTokensEstimate: number;
  durationMs: number;
  laneBreakdown: unknown;
};

type LlmAuditByLane = Record<
  string,
  { calls: number; failedCalls: number; tokens: number; durationMs: number }
>;

export function PipelineRunHistory({
  runs,
  llmAuditByLane,
}: {
  runs: RecentRunRow[];
  llmAuditByLane: LlmAuditByLane;
}) {
  const hasAudit = Object.keys(llmAuditByLane).length > 0;
  if (runs.length === 0 && !hasAudit) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      {runs.length > 0 && (
        <div className="card-base p-4">
          <h3 className="text-lg font-semibold">Recent Pipeline Runs</h3>
          <p className="text-muted mt-1 text-sm">Persisted lane history from the last 8 runs.</p>
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
                {runs.map((run) => {
                  const laneBreakdown = normalizeLaneBreakdown(run.laneBreakdown);
                  const scopeLabel =
                    run.scopeCitySlugs.length > 0
                      ? `Cities: ${run.scopeCitySlugs.join(', ')}`
                      : run.scopeRegionIds.length > 0
                        ? `Regions: ${run.scopeRegionIds.join(', ')}`
                        : 'All enabled';
                  return (
                    <tr key={run.id} className="border-t border-slate-100 align-top text-slate-700">
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

      {hasAudit && (
        <div className="card-base p-4">
          <h3 className="text-lg font-semibold">LLM Audit by Lane</h3>
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
  );
}
