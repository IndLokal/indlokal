'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineRunResult, PipelineRunScope } from '@/modules/pipeline';

type RegionOption = {
  id: string;
  label: string;
};

type RunPipelineButtonProps = {
  regions: RegionOption[];
};

function getScopeLabel(scope: PipelineRunScope | null, regions: RegionOption[]): string {
  if (!scope?.regionIds?.length && !scope?.citySlugs?.length) return 'All enabled regions';

  if (scope?.regionIds?.length) {
    const regionLabels = scope.regionIds.map(
      (regionId) => regions.find((region) => region.id === regionId)?.label ?? regionId,
    );
    return regionLabels.join(', ');
  }

  return `Cities: ${(scope.citySlugs ?? []).join(', ')}`;
}

export default function RunPipelineButton({ regions }: RunPipelineButtonProps) {
  const router = useRouter();
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [scope, setScope] = useState<PipelineRunScope | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(nextScope?: PipelineRunScope, scopeKey = 'all') {
    setRunningKey(scopeKey);
    setResult(null);
    setScope(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextScope ?? {}),
      });

      const payload = (await response.json()) as
        | { ok: true; scope: PipelineRunScope | null; result: PipelineRunResult }
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? 'Pipeline run failed' : (payload.error ?? 'Pipeline run failed'),
        );
      }

      setResult(payload.result);
      setScope(payload.scope);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleRun(undefined, 'all')}
          disabled={runningKey != null}
          className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runningKey === 'all' ? '⏳ Running All…' : '🚀 Run All Regions'}
        </button>
        {regions.map((region) => (
          <button
            key={region.id}
            onClick={() => handleRun({ regionIds: [region.id] }, region.id)}
            disabled={runningKey != null}
            className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningKey === region.id ? `⏳ ${region.label}…` : region.label}
          </button>
        ))}
      </div>

      {result && (
        <div className="border-border bg-muted-bg mt-3 rounded-[var(--radius-button)] border p-4 text-sm">
          <p className="text-foreground font-semibold">
            Pipeline Complete ({(result.duration / 1000).toFixed(1)}s)
          </p>
          <p className="text-muted mt-1 text-xs">Scope: {getScopeLabel(scope, regions)}</p>
          <div className="text-muted mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
            <span>Sources processed:</span>
            <span className="font-medium">{result.sourcesProcessed}</span>
            <span>Items fetched:</span>
            <span className="font-medium">{result.itemsFetched}</span>
            <span>Passed filter:</span>
            <span className="font-medium">{result.itemsPassedFilter}</span>
            <span>Extracted:</span>
            <span className="font-medium">{result.itemsExtracted}</span>
            <span>Queued for review:</span>
            <span className="font-medium text-green-700">{result.itemsQueued}</span>
            <span>Duplicates skipped:</span>
            <span className="font-medium">{result.itemsSkippedDuplicate}</span>
            <span>No city (skipped):</span>
            <span className="font-medium">{result.itemsSkippedNoCity}</span>
            <span>LLM calls:</span>
            <span className="font-medium">{result.llmCalls}</span>
            <span>Est. tokens:</span>
            <span className="font-medium">~{result.llmTokensEstimate}</span>
          </div>
          {result.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-amber-600">
                ⚠️ {result.errors.length} errors
              </summary>
              <ul className="text-muted mt-1 space-y-0.5 text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </details>
          )}
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
