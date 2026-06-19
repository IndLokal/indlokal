/**
 * POST /api/cron/pipeline/dispatch
 *
 * Fans out one POST per enabled region to /api/cron/pipeline.
 *
 * Request:
 * - Requires Authorization: Bearer CRON_SECRET.
 * - Optional JSON body: { runMode, sourceIntentProfile }.
 * - If options are omitted, selects smart daily defaults.
 * - Invalid option values return HTTP 400.
 *
 * Shard semantics:
 * - 2xx from shard = dispatched.
 * - 409 from shard = locked (already running), treated as non-fatal.
 * - Non-2xx (except 409) or fetch errors = failed.
 *
 * Response payload:
 * - ok: true when no real failures occurred.
 * - runMode, sourceIntentProfile, strategy: effective options used.
 * - dispatched, locked, failed, concurrency.
 * - If no enabled regions: { ok: true, dispatched: [], reason: 'no enabled regions' }.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnabledRegions } from '@/modules/pipeline/config/runtime-config';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

export const maxDuration = 300; // dispatch can await shard responses in large runs

const VALID_RUN_MODES = [
  'balanced',
  'event_refresh',
  'community_discovery',
  'resource_discovery',
  'evidence_verification',
] as const;

type RunMode = (typeof VALID_RUN_MODES)[number];

const VALID_SOURCE_INTENT_PROFILES = [
  'all',
  'activity_only',
  'community_only',
  'service_only',
  'evidence_only',
  'channel_only',
] as const;

type SourceIntentProfile = (typeof VALID_SOURCE_INTENT_PROFILES)[number];

const RUN_MODE_SET = new Set<string>(VALID_RUN_MODES);
const SOURCE_INTENT_PROFILE_SET = new Set<string>(VALID_SOURCE_INTENT_PROFILES);

type OptionStrategy = 'explicit' | 'smart-default';

type RunOptions = {
  runMode: RunMode;
  sourceIntentProfile: SourceIntentProfile;
  strategy: OptionStrategy;
};

function getConcurrency(): number {
  const raw = Number.parseInt(process.env.PIPELINE_DISPATCH_CONCURRENCY ?? '', 10);
  if (!Number.isFinite(raw) || raw < 1) return 4;
  return Math.min(raw, 20);
}

/** Resolve app base URL from APP_URL first, then forwarded host headers. */
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
  locked: boolean;
  status: number | null;
  statusText?: string;
  error?: string;
};

type DispatchRunOptions = {
  runMode?: string;
  sourceIntentProfile?: string;
};

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

function normalizeOption(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Lightweight daily rotation to reduce average token/time pressure.
 * Triggered only when cron callers do not specify explicit options.
 */
function getSmartCronOptions(now = new Date()): {
  runMode: RunMode;
  sourceIntentProfile: SourceIntentProfile;
  strategy: 'smart-default';
} {
  const utcDay = now.getUTCDay();
  switch (utcDay) {
    case 1:
      return {
        runMode: 'event_refresh',
        sourceIntentProfile: 'activity_only',
        strategy: 'smart-default',
      };
    case 2:
      return {
        runMode: 'community_discovery',
        sourceIntentProfile: 'community_only',
        strategy: 'smart-default',
      };
    case 3:
      return {
        runMode: 'event_refresh',
        sourceIntentProfile: 'activity_only',
        strategy: 'smart-default',
      };
    case 4:
      return {
        runMode: 'resource_discovery',
        sourceIntentProfile: 'service_only',
        strategy: 'smart-default',
      };
    case 5:
      return {
        runMode: 'event_refresh',
        sourceIntentProfile: 'activity_only',
        strategy: 'smart-default',
      };
    case 6:
      return {
        runMode: 'evidence_verification',
        sourceIntentProfile: 'evidence_only',
        strategy: 'smart-default',
      };
    default:
      return { runMode: 'balanced', sourceIntentProfile: 'all', strategy: 'smart-default' };
  }
}

function parseRequestedOptions(
  body: DispatchRunOptions,
):
  | { ok: true; runMode?: RunMode; sourceIntentProfile?: SourceIntentProfile }
  | { ok: false; status: 400; error: string } {
  const explicitRunMode = normalizeOption(body.runMode);
  const explicitSourceIntentProfile = normalizeOption(body.sourceIntentProfile);

  if (explicitRunMode && !RUN_MODE_SET.has(explicitRunMode)) {
    return { ok: false, status: 400, error: `Invalid runMode: ${explicitRunMode}` };
  }
  if (explicitSourceIntentProfile && !SOURCE_INTENT_PROFILE_SET.has(explicitSourceIntentProfile)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid sourceIntentProfile: ${explicitSourceIntentProfile}`,
    };
  }

  return {
    ok: true,
    runMode: explicitRunMode as RunMode | undefined,
    sourceIntentProfile: explicitSourceIntentProfile as SourceIntentProfile | undefined,
  };
}

function resolveRunOptions(parsed: {
  runMode?: RunMode;
  sourceIntentProfile?: SourceIntentProfile;
}): RunOptions {
  const defaults = getSmartCronOptions();
  return {
    runMode: parsed.runMode ?? defaults.runMode,
    sourceIntentProfile: parsed.sourceIntentProfile ?? defaults.sourceIntentProfile,
    strategy: parsed.runMode || parsed.sourceIntentProfile ? 'explicit' : defaults.strategy,
  };
}

function buildShardUrl(baseUrl: string, regionId: string, options: RunOptions): string {
  const shardUrl = new URL(`${baseUrl}/api/cron/pipeline`);
  shardUrl.searchParams.set('region', regionId);
  shardUrl.searchParams.set('runMode', options.runMode);
  shardUrl.searchParams.set('sourceIntentProfile', options.sourceIntentProfile);
  return shardUrl.toString();
}

function summarizeOutcomes(outcomes: DispatchOutcome[]) {
  const dispatched = outcomes.filter((o) => o.ok && !o.locked).map((o) => o.regionId);
  const locked = outcomes.filter((o) => o.locked).map((o) => o.regionId);
  const failed = outcomes.filter((o) => !o.ok);
  return { dispatched, locked, failed };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: 'APP_URL env not set and request has no Host header' },
      { status: 500 },
    );
  }
  const resolvedBaseUrl = baseUrl;

  const regions = await getRuntimeEnabledRegions();
  if (regions.length === 0) {
    return NextResponse.json({ ok: true, dispatched: [], reason: 'no enabled regions' });
  }

  const requestBody = ((await req.json().catch(() => null)) ?? {}) as DispatchRunOptions;
  const parsedOptions = parseRequestedOptions(requestBody);
  if (!parsedOptions.ok) {
    return NextResponse.json(
      { ok: false, error: parsedOptions.error },
      { status: parsedOptions.status },
    );
  }

  const runOptions = resolveRunOptions(parsedOptions);

  const concurrency = getConcurrency();
  const outcomes: DispatchOutcome[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < regions.length) {
      const idx = cursor++;
      const region = regions[idx];
      const url = buildShardUrl(resolvedBaseUrl, region.id, runOptions);
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
        const resTextClone = res.clone();
        const locked = res.status === 409;
        let error: string | undefined;
        if (!res.ok && !locked) {
          const payload = await res.json().catch(() => null);
          if (payload && typeof payload === 'object') {
            const data = payload as { error?: unknown; reason?: unknown };
            if (typeof data.error === 'string' && data.error.trim().length > 0) {
              error = data.error;
            } else if (typeof data.reason === 'string' && data.reason.trim().length > 0) {
              error = data.reason;
            }
          }
          if (!error) {
            const text = await resTextClone.text().catch(() => '');
            if (text.trim().length > 0) {
              error = text.trim().slice(0, 240);
            }
          }
        }
        outcomes.push({
          regionId: region.id,
          ok: res.ok || locked,
          locked,
          status: res.status,
          statusText: res.statusText,
          error,
        });
      } catch (err) {
        outcomes.push({
          regionId: region.id,
          ok: false,
          locked: false,
          status: null,
          error: String((err as { message?: unknown })?.message ?? err),
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, regions.length) }, () => worker());
  await Promise.all(workers);

  const { dispatched, locked, failed } = summarizeOutcomes(outcomes);

  await captureServerEvent('system-cron', Events.PIPELINE_DISPATCHED, {
    trigger: 'cron',
    run_mode: runOptions.runMode,
    source_intent_profile: runOptions.sourceIntentProfile,
    run_option_strategy: runOptions.strategy,
    regions_total: regions.length,
    regions_dispatched: dispatched.length,
    regions_locked: locked.length,
    regions_failed: failed.length,
    concurrency,
  });

  return NextResponse.json({
    ok: failed.length === 0,
    runMode: runOptions.runMode,
    sourceIntentProfile: runOptions.sourceIntentProfile,
    strategy: runOptions.strategy,
    dispatched,
    locked,
    failed,
    concurrency,
  });
}
