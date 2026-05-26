import { type NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/modules/pipeline';
import { tryAdvisoryLock } from '@/lib/db/advisory-lock';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

export const maxDuration = 300; // 5 min - pipeline can be slow

function parseScopeParam(url: URL, key: 'city' | 'region'): string[] {
  return Array.from(
    new Set(
      url.searchParams
        .getAll(key)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function buildLockKey(citySlugs: string[], regionIds: string[]): string {
  const parts: string[] = [];
  if (regionIds.length > 0) parts.push(`region=${[...regionIds].sort().join(',')}`);
  if (citySlugs.length > 0) parts.push(`city=${[...citySlugs].sort().join(',')}`);
  if (parts.length === 0) parts.push('global');
  return `pipeline:cron:${parts.join('|')}`;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const citySlugs = parseScopeParam(url, 'city');
  const regionIds = parseScopeParam(url, 'region');

  const lockKey = buildLockKey(citySlugs, regionIds);
  const lock = await tryAdvisoryLock(lockKey);
  if (!lock.acquired) {
    console.info(`[cron/pipeline] lock conflict for key=${lockKey}`);
    return NextResponse.json(
      { ok: false, reason: 'locked', scope: { citySlugs, regionIds } },
      { status: 409 },
    );
  }

  try {
    const scope =
      citySlugs.length > 0 || regionIds.length > 0
        ? {
            citySlugs: citySlugs.length > 0 ? citySlugs : undefined,
            regionIds: regionIds.length > 0 ? regionIds : undefined,
          }
        : undefined;
    const result = await runPipeline('cron', scope);

    await captureServerEvent('system-cron', Events.PIPELINE_SHARD_COMPLETED, {
      trigger: 'cron',
      region_ids: regionIds,
      city_slugs: citySlugs,
      regions_scanned: result.regionsScanned,
      sources_processed: result.sourcesProcessed,
      items_fetched: result.itemsFetched,
      items_queued: result.itemsQueued,
      errors_count: result.errors.length,
      duration_ms: result.duration,
      filter_failures: result.filterFailures,
      extract_retries_exhausted: result.extractRetriesExhausted,
      items_dropped_bad_index: result.itemsDroppedBadIndex,
      budget_exceeded: result.budgetExceeded,
      circuit_breaker_tripped: result.circuitBreakerTripped,
    });

    return NextResponse.json({ ok: true, scope: scope ?? null, result });
  } catch (err) {
    console.error('[cron/pipeline]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    await lock.release();
  }
}
