'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineRunResult, PipelineRunScope } from '@/modules/pipeline';

type PipelineRunMode =
  | 'balanced'
  | 'event_refresh'
  | 'community_discovery'
  | 'resource_discovery'
  | 'evidence_verification';

type PipelineSourceIntentProfile =
  | 'all'
  | 'activity_only'
  | 'community_only'
  | 'service_only'
  | 'evidence_only'
  | 'channel_only';

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

const RUN_MODE_OPTIONS: Array<{ value: PipelineRunMode; label: string }> = [
  { value: 'balanced', label: 'Balanced (default)' },
  { value: 'event_refresh', label: 'Event refresh' },
  { value: 'community_discovery', label: 'Community discovery' },
  { value: 'resource_discovery', label: 'Resource discovery' },
  { value: 'evidence_verification', label: 'Evidence verification' },
];

const INTENT_PROFILE_OPTIONS: Array<{ value: PipelineSourceIntentProfile; label: string }> = [
  { value: 'all', label: 'All intents (default)' },
  { value: 'activity_only', label: 'Activity only' },
  { value: 'community_only', label: 'Community only' },
  { value: 'service_only', label: 'Service only' },
  { value: 'evidence_only', label: 'Evidence only' },
  { value: 'channel_only', label: 'Channel only' },
];

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
  const [runMode, setRunMode] = useState<PipelineRunMode>('balanced');
  const [sourceIntentProfile, setSourceIntentProfile] =
    useState<PipelineSourceIntentProfile>('all');
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
        body: JSON.stringify({
          ...(nextScope ?? {}),
          runMode,
          sourceIntentProfile,
        }),
      });

      const payload = (await response.json()) as
        | {
            ok: true;
            mode: 'direct';
            scope: PipelineRunScope | null;
            result: PipelineRunResult;
            note?: string;
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
            ? `Dispatched ${payload.dispatch.dispatched.length} regional shards.`
            : `Dispatched ${payload.dispatch.dispatched.length} shards, ${failedCount} failed to dispatch.`,
        );
        setScope(null);
        setResult(null);
      } else if (payload.ok && payload.mode === 'direct') {
        setResult(payload.result);
        setScope(payload.scope);
        if (payload.note) {
          setDispatchMessage(payload.note);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <button
          onClick={() => handleRun(undefined, 'all')}
          disabled={runningKey != null}
          className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runningKey === 'all' ? 'Running all regions...' : 'Run all regions'}
        </button>
        <span className="text-muted text-xs sm:text-right">
          Runs all {regions.length} enabled regions. Tries async shard dispatch first, then falls
          back to direct execution if dispatch is unavailable.
        </span>

        <details className="w-full rounded-[var(--radius-button)] border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
            Advanced · run a single region or city
          </summary>
          <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Run mode
                </span>
                <select
                  value={runMode}
                  onChange={(event) => setRunMode(event.target.value as PipelineRunMode)}
                  disabled={runningKey != null}
                  className="rounded-[var(--radius-button)] border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {RUN_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Intent profile
                </span>
                <select
                  value={sourceIntentProfile}
                  onChange={(event) =>
                    setSourceIntentProfile(event.target.value as PipelineSourceIntentProfile)
                  }
                  disabled={runningKey != null}
                  className="rounded-[var(--radius-button)] border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {INTENT_PROFILE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
        </details>
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
                    <th className="px-2 py-1 font-medium">Conflicts</th>
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
                        <td className="px-2 py-1.5">{metrics.cityConflicts}</td>
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
