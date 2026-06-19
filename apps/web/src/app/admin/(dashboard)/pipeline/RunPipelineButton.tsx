'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineRunResult, PipelineRunScope } from '@/modules/pipeline';

type RegionOption = {
  id: string;
  label: string;
};

type CityOption = {
  slug: string;
  label: string;
};

type RunPipelineButtonProps = {
  regions: RegionOption[];
  cities: CityOption[];
};

function getScopeLabel(
  scope: PipelineRunScope | null,
  regions: RegionOption[],
  cities: CityOption[],
): string {
  if (!scope?.regionIds?.length && !scope?.citySlugs?.length) return 'All enabled regions';

  if (scope?.regionIds?.length) {
    const regionLabels = scope.regionIds.map(
      (regionId) => regions.find((region) => region.id === regionId)?.label ?? regionId,
    );
    return regionLabels.join(', ');
  }

  const cityLabels = (scope.citySlugs ?? []).map(
    (slug) => cities.find((city) => city.slug === slug)?.label ?? slug,
  );
  return `Cities: ${cityLabels.join(', ')}`;
}

export default function RunPipelineButton({ regions, cities }: RunPipelineButtonProps) {
  const router = useRouter();
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<PipelineRunScope | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(nextScope?: PipelineRunScope, scopeKey = 'all') {
    setRunningKey(scopeKey);
    setResult(null);
    setDispatchMessage(null);
    setScope(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextScope ?? {}),
      });

      const payload = (await response.json()) as
        | {
            ok: true;
            mode: 'direct';
            scope: PipelineRunScope | null;
            result: PipelineRunResult;
          }
        | {
            ok: true;
            mode: 'dispatch';
            dispatch: {
              ok: boolean;
              dispatched: string[];
              failed?: Array<{ regionId: string; status: number | null; error?: string }>;
              concurrency?: number;
            };
          }
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? 'Pipeline run failed' : (payload.error ?? 'Pipeline run failed'),
        );
      }

      if (payload.ok && payload.mode === 'dispatch') {
        const failedCount = payload.dispatch.failed?.length ?? 0;
        setDispatchMessage(
          failedCount === 0
            ? `Dispatched ${payload.dispatch.dispatched.length} regional cron shards.`
            : `Dispatched ${payload.dispatch.dispatched.length} shards, ${failedCount} failed to dispatch.`,
        );
        setScope(null);
        setResult(null);
      } else if (payload.ok && payload.mode === 'direct') {
        setResult(payload.result);
        setScope(payload.scope);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className="card-base w-full max-w-2xl p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-brand-700 text-xs font-semibold tracking-[0.18em] uppercase">
              Manual Run Controls
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Run pipeline by shard</h2>
            <p className="text-muted mt-1 max-w-xl text-sm">
              Manual runs now follow the same regional scope model as cron. Run one region to debug
              yield, or run all enabled regions for a full pass.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {regions.length} enabled regions
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleRun(undefined, 'all')}
              disabled={runningKey != null}
              className="btn-primary w-full px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningKey === 'all' ? '⏳ Running all regions…' : 'Run all enabled regions'}
            </button>
            <p className="text-muted text-xs">
              Runs via cron-style regional dispatch (asynchronous). Use city/region shards below for
              immediate per-run metrics.
            </p>

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Regional shards
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {regions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => handleRun({ regionIds: [region.id] }, region.id)}
                    disabled={runningKey != null}
                    className="btn-secondary justify-center px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {runningKey === region.id ? `⏳ ${region.label}…` : region.label}
                  </button>
                ))}
              </div>
            </div>

            {cities.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  City shards
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {cities.map((city) => (
                    <button
                      key={city.slug}
                      onClick={() => handleRun({ citySlugs: [city.slug] }, `city:${city.slug}`)}
                      disabled={runningKey != null}
                      className="btn-secondary justify-center px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {runningKey === `city:${city.slug}` ? `⏳ ${city.label}…` : city.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50/70 p-4 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-900">
                Pipeline complete in {(result.duration / 1000).toFixed(1)}s
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">
                Scope: {getScopeLabel(scope, regions, cities)}
              </p>
            </div>
            <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-200">
              {result.errors.length === 0
                ? 'No fetch errors'
                : `${result.errors.length} issues logged`}
            </div>
          </div>

          {(result.budgetExceeded || result.circuitBreakerTripped) && (
            <div className="mt-3 rounded-[var(--radius-button)] border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold tracking-wide uppercase">Cost guard tripped</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.budgetExceeded && (
                  <li>
                    Token budget exceeded - LLM stages bailed out. Tune
                    <code className="mx-1">PIPELINE_RUN_TOKEN_BUDGET</code>or reduce scope.
                  </li>
                )}
                {result.circuitBreakerTripped && (
                  <li>
                    Circuit breaker opened after consecutive LLM failures. Check upstream provider
                    health before re-running.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Queued" value={result.itemsQueued} tone="success" />
            <MetricCard label="Fetched" value={result.itemsFetched} />
            <MetricCard label="Extracted" value={result.itemsExtracted} />
            <MetricCard label="LLM calls" value={result.llmCalls} />
          </div>

          <details className="mt-4 rounded-[var(--radius-button)] border border-slate-200 bg-white/80 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">
              View lane-level outcomes
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1 font-medium">Lane</th>
                    <th className="px-2 py-1 font-medium">Fetched</th>
                    <th className="px-2 py-1 font-medium">Passed filter</th>
                    <th className="px-2 py-1 font-medium">Extracted</th>
                    <th className="px-2 py-1 font-medium">Queued</th>
                    <th className="px-2 py-1 font-medium">Duplicates</th>
                    <th className="px-2 py-1 font-medium">No city</th>
                    <th className="px-2 py-1 font-medium">Past</th>
                  </tr>
                </thead>
                <tbody>
                  {(['EVENT', 'COMMUNITY', 'RESOURCE', 'UNKNOWN'] as const).map((lane) => {
                    const metrics = result.laneBreakdown[lane];
                    return (
                      <tr key={lane} className="border-t border-slate-100 text-slate-700">
                        <td className="px-2 py-1.5 font-medium">{lane}</td>
                        <td className="px-2 py-1.5">{metrics.fetched}</td>
                        <td className="px-2 py-1.5">{metrics.passedFilter}</td>
                        <td className="px-2 py-1.5">{metrics.extracted}</td>
                        <td className="px-2 py-1.5">{metrics.queued}</td>
                        <td className="px-2 py-1.5">{metrics.duplicates}</td>
                        <td className="px-2 py-1.5">{metrics.noCity}</td>
                        <td className="px-2 py-1.5">{metrics.past}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>

          <div className="text-muted mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <StatLine label="Sources processed" value={result.sourcesProcessed} />
            <StatLine label="Passed filter" value={result.itemsPassedFilter} />
            <StatLine label="Duplicates skipped" value={result.itemsSkippedDuplicate} />
            <StatLine label="No city skipped" value={result.itemsSkippedNoCity} />
            <StatLine label="Estimated tokens" value={`~${result.llmTokensEstimate}`} />
            <StatLine label="Duration" value={`${(result.duration / 1000).toFixed(1)}s`} />
            <StatLine
              label="Filter batches dropped"
              value={result.filterFailures}
              tone={result.filterFailures > 0 ? 'warn' : 'default'}
            />
            <StatLine
              label="Extract retries exhausted"
              value={result.extractRetriesExhausted}
              tone={result.extractRetriesExhausted > 0 ? 'warn' : 'default'}
            />
            <StatLine
              label="Items dropped (bad index)"
              value={result.itemsDroppedBadIndex}
              tone={result.itemsDroppedBadIndex > 0 ? 'warn' : 'default'}
            />
          </div>

          {result.errors.length > 0 && (
            <details className="mt-4 rounded-[var(--radius-button)] border border-amber-200 bg-white/70 p-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-700">
                View {result.errors.length} logged fetch/runtime issues
              </summary>
              <ul className="text-muted mt-2 max-h-48 space-y-1 overflow-auto text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </details>
          )}

          {result.cityBreakdown.length > 0 && (
            <details className="mt-4 rounded-[var(--radius-button)] border border-slate-200 bg-white/80 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                View city-level outcomes
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-1 font-medium">City</th>
                      <th className="px-2 py-1 font-medium">Extracted</th>
                      <th className="px-2 py-1 font-medium">Queued (E/C/R)</th>
                      <th className="px-2 py-1 font-medium">Duplicates (E/C/R)</th>
                      <th className="px-2 py-1 font-medium">Past events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cityBreakdown.map((city) => (
                      <tr key={city.citySlug} className="border-t border-slate-100 text-slate-700">
                        <td className="px-2 py-1.5">{city.cityName}</td>
                        <td className="px-2 py-1.5">{city.extracted}</td>
                        <td className="px-2 py-1.5">
                          {city.queuedEvents}/{city.queuedCommunities}/{city.queuedResources}
                        </td>
                        <td className="px-2 py-1.5">
                          {city.duplicateEvents}/{city.duplicateCommunities}/
                          {city.duplicateResources}
                        </td>
                        <td className="px-2 py-1.5">{city.pastEvents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {dispatchMessage && (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          {dispatchMessage}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Pipeline failed: {error}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success';
}) {
  return (
    <div
      className={`rounded-[var(--radius-button)] border px-3 py-3 ${
        tone === 'success'
          ? 'border-emerald-200 bg-white text-emerald-900'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatLine({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div>
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 font-medium ${tone === 'warn' ? 'text-amber-700' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}
