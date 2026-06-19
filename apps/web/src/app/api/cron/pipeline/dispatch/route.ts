/**
 * POST /api/cron/pipeline/dispatch - fan-out cron entrypoint (PRD/TDD-0029).
 *
 * Reads enabled regions from `pipeline_source_configs` via
 * `getRuntimeEnabledRegions()` and fires one POST per region against the
 * existing `/api/cron/pipeline?region=<id>` endpoint. Each per-region
 * invocation is its own Vercel serverless function instance, so each gets
 * its own 300s budget, its own advisory lock (already region-scoped in
 * `buildLockKey`), and its own `PipelineRun` row.
 *
 * The dispatcher does NOT wait for the per-region runs to finish - they
 * complete asynchronously. Concurrency is bounded by
 * `PIPELINE_DISPATCH_CONCURRENCY` to avoid waking 20+ Lambdas at once.
 *
 * Why this and not a real queue (Inngest / pg-boss)?
 *   - We already have horizontal sharding via GitHub Actions cron entries.
 *     The bloat is that those entries are hardcoded per region, so adding
 *     a 5th region means editing YAML and a deploy. This route replaces 4
 *     YAML blocks with 1 cron entry that scales with the DB-managed
 *     region list (today 4, design target 20+).
 *   - Per-region retry on transient failure is deferred: a failed region
 *     is retried on the next cron tick. That is acceptable at MVP scale
 *     and avoids introducing a job table + worker + dead-letter machinery
 *     before we have evidence we need them.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnabledRegions } from '@/modules/pipeline/config/runtime-config';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

export const maxDuration = 60; // dispatch is HTTP fan-out only

function getConcurrency(): number {
  const raw = Number.parseInt(process.env.PIPELINE_DISPATCH_CONCURRENCY ?? '', 10);
  if (!Number.isFinite(raw) || raw < 1) return 4;
  return Math.min(raw, 20);
}

function getBaseUrl(req: NextRequest): string | null {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  return host ? `${proto}://${host}` : null;
}

type DispatchOutcome = {
  regionId: string;
  ok: boolean;
  status: number | null;
  error?: string;
};

type DispatchRunOptions = {
  runMode?: string;
  sourceIntentProfile?: string;
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: 'APP_URL env not set and request has no Host header' },
      { status: 500 },
    );
  }

  const regions = await getRuntimeEnabledRegions();
  if (regions.length === 0) {
    return NextResponse.json({ ok: true, dispatched: [], reason: 'no enabled regions' });
  }

  const requestBody = ((await req.json().catch(() => null)) ?? {}) as DispatchRunOptions;
  const runMode = typeof requestBody.runMode === 'string' ? requestBody.runMode.trim() : '';
  const sourceIntentProfile =
    typeof requestBody.sourceIntentProfile === 'string'
      ? requestBody.sourceIntentProfile.trim()
      : '';

  const concurrency = getConcurrency();
  const outcomes: DispatchOutcome[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < regions.length) {
      const idx = cursor++;
      const region = regions[idx];
      const shardUrl = new URL(`${baseUrl}/api/cron/pipeline`);
      shardUrl.searchParams.set('region', region.id);
      if (runMode) shardUrl.searchParams.set('runMode', runMode);
      if (sourceIntentProfile) {
        shardUrl.searchParams.set('sourceIntentProfile', sourceIntentProfile);
      }
      const url = shardUrl.toString();
      try {
        // Per-region runs can take up to 300s, but we don't await the body -
        // we only need to know the dispatch succeeded. The downstream
        // endpoint persists its own PipelineRun row regardless.
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
            'content-type': 'application/json',
          },
          // Allow long-running per-region invocation to proceed asynchronously
          // on Vercel without blocking the dispatcher response.
          keepalive: true,
        });
        outcomes.push({ regionId: region.id, ok: res.ok, status: res.status });
      } catch (err) {
        outcomes.push({
          regionId: region.id,
          ok: false,
          status: null,
          error: String((err as { message?: unknown })?.message ?? err),
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, regions.length) }, () => worker());
  await Promise.all(workers);

  const dispatched = outcomes.filter((o) => o.ok).map((o) => o.regionId);
  const failed = outcomes.filter((o) => !o.ok);

  await captureServerEvent('system-cron', Events.PIPELINE_DISPATCHED, {
    trigger: 'cron',
    regions_total: regions.length,
    regions_dispatched: dispatched.length,
    regions_failed: failed.length,
    concurrency,
  });

  return NextResponse.json({
    ok: failed.length === 0,
    dispatched,
    failed,
    concurrency,
  });
}
