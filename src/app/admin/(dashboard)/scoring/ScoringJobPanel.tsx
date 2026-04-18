'use client';

import { useState } from 'react';
import { runScoreRefresh, runLinkCheck, type JobResult } from './actions';

export function ScoringJobPanel() {
  const [scoreResult, setScoreResult] = useState<JobResult | null>(null);
  const [linkResult, setLinkResult] = useState<JobResult | null>(null);
  const [scoreRunning, setScoreRunning] = useState(false);
  const [linkRunning, setLinkRunning] = useState(false);

  async function handleScoreRefresh() {
    setScoreRunning(true);
    setScoreResult(null);
    try {
      const result = await runScoreRefresh();
      setScoreResult(result);
    } finally {
      setScoreRunning(false);
    }
  }

  async function handleLinkCheck() {
    setLinkRunning(true);
    setLinkResult(null);
    try {
      const result = await runLinkCheck();
      setLinkResult(result);
    } finally {
      setLinkRunning(false);
    }
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {/* Score refresh */}
      <div className="card-base p-5">
        <h3 className="font-semibold">Refresh All Scores</h3>
        <p className="text-muted mt-1 text-sm">
          Recomputes activity, completeness, and trust scores for every active community. Includes
          engagement signals from page views.
        </p>
        <button
          onClick={handleScoreRefresh}
          disabled={scoreRunning}
          className="btn-primary mt-4 px-4 py-2 text-sm disabled:opacity-50"
        >
          {scoreRunning ? 'Running…' : 'Run Score Refresh'}
        </button>
        {scoreResult && (
          <p className={`mt-3 text-sm ${scoreResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {scoreResult.ok ? `✓ ${scoreResult.message}` : `✗ ${scoreResult.error}`}
          </p>
        )}
      </div>

      {/* Link check */}
      <div className="card-base p-5">
        <h3 className="font-semibold">Check Broken Links</h3>
        <p className="text-muted mt-1 text-sm">
          Sends a HEAD request to every access channel URL not checked in the last 24 hours. Marks
          each as verified or unreachable.
        </p>
        <button
          onClick={handleLinkCheck}
          disabled={linkRunning}
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {linkRunning ? 'Checking links…' : 'Run Link Check'}
        </button>
        {linkResult && (
          <p className={`mt-3 text-sm ${linkResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {linkResult.ok ? `✓ ${linkResult.message}` : `✗ ${linkResult.error}`}
          </p>
        )}
      </div>
    </div>
  );
}
