import { type NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/modules/pipeline';
import { tryAdvisoryLock } from '@/lib/db/advisory-lock';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

export const maxDuration = 300; // 5 min - pipeline can be slow

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

const VALID_RUN_MODES: PipelineRunMode[] = [
  'balanced',
  'event_refresh',
  'community_discovery',
  'resource_discovery',
  'evidence_verification',
];

const VALID_SOURCE_INTENT_PROFILES: PipelineSourceIntentProfile[] = [
  'all',
  'activity_only',
  'community_only',
  'service_only',
  'evidence_only',
  'channel_only',
];

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

function parseOptionParam(url: URL, key: 'runMode' | 'sourceIntentProfile'): string | undefined {
  const value = url.searchParams.get(key);
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function parseRunMode(url: URL): PipelineRunMode | undefined {
  const raw = parseOptionParam(url, 'runMode');
  if (!raw) return undefined;
  return VALID_RUN_MODES.includes(raw as PipelineRunMode) ? (raw as PipelineRunMode) : undefined;
}

function parseSourceIntentProfile(url: URL): PipelineSourceIntentProfile | undefined {
  const raw = parseOptionParam(url, 'sourceIntentProfile');
  if (!raw) return undefined;
  return VALID_SOURCE_INTENT_PROFILES.includes(raw as PipelineSourceIntentProfile)
    ? (raw as PipelineSourceIntentProfile)
    : undefined;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const citySlugs = parseScopeParam(url, 'city');
  const regionIds = parseScopeParam(url, 'region');
  const runMode = parseRunMode(url);
  const sourceIntentProfile = parseSourceIntentProfile(url);

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
    const result = await runPipeline('cron', scope, { runMode, sourceIntentProfile });

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
