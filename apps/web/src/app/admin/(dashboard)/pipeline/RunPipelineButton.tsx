'use client';

import { useState } from 'react';
import { triggerPipelineRun } from './actions';
import type { PipelineRunResult } from '@/modules/pipeline';

export default function RunPipelineButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await triggerPipelineRun();
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleRun}
        disabled={running}
        className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? '⏳ Running Pipeline…' : '🚀 Run Pipeline Now'}
      </button>

      {result && (
        <div className="border-border bg-muted-bg mt-3 rounded-[var(--radius-button)] border p-4 text-sm">
          <p className="text-foreground font-semibold">
            Pipeline Complete ({(result.duration / 1000).toFixed(1)}s)
          </p>
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
