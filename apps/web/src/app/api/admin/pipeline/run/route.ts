import { type NextRequest, NextResponse } from 'next/server';
import { assertCan } from '@/lib/auth/permissions';
import { runPipeline, type PipelineRunScope } from '@/modules/pipeline';

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

export const runtime = 'nodejs';
export const maxDuration = 300;

function normalizeScopeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function getBaseUrl(req: NextRequest): string | null {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  return host ? `${proto}://${host}` : null;
}

function normalizeSingleString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function parseRunMode(value: unknown): PipelineRunMode | undefined {
  const normalized = normalizeSingleString(value);
  if (!normalized) return undefined;
  return VALID_RUN_MODES.includes(normalized as PipelineRunMode)
    ? (normalized as PipelineRunMode)
    : undefined;
}

function parseSourceIntentProfile(value: unknown): PipelineSourceIntentProfile | undefined {
  const normalized = normalizeSingleString(value);
  if (!normalized) return undefined;
  return VALID_SOURCE_INTENT_PROFILES.includes(normalized as PipelineSourceIntentProfile)
    ? (normalized as PipelineSourceIntentProfile)
    : undefined;
}

export async function POST(req: NextRequest) {
  try {
    await assertCan('pipeline.run');

    const body = ((await req.json().catch(() => null)) ?? {}) as {
      regionIds?: unknown;
      citySlugs?: unknown;
      runMode?: unknown;
      sourceIntentProfile?: unknown;
    };

    const regionIds = normalizeScopeList(body.regionIds);
    const citySlugs = normalizeScopeList(body.citySlugs);
    const scope: PipelineRunScope | undefined =
      regionIds.length > 0 || citySlugs.length > 0
        ? {
            regionIds: regionIds.length > 0 ? regionIds : undefined,
            citySlugs: citySlugs.length > 0 ? citySlugs : undefined,
          }
        : undefined;

    const rawRunMode = normalizeSingleString(body.runMode);
    const rawSourceIntentProfile = normalizeSingleString(body.sourceIntentProfile);
    const runMode = parseRunMode(body.runMode);
    const sourceIntentProfile = parseSourceIntentProfile(body.sourceIntentProfile);
    if (rawRunMode && !runMode) {
      return NextResponse.json(
        { ok: false, error: `Invalid runMode: ${rawRunMode}` },
        { status: 400 },
      );
    }
    if (rawSourceIntentProfile && !sourceIntentProfile) {
      return NextResponse.json(
        { ok: false, error: `Invalid sourceIntentProfile: ${rawSourceIntentProfile}` },
        { status: 400 },
      );
    }

    const runOptions = {
      runMode,
      sourceIntentProfile,
    };

    // Align "Run all enabled regions" with cron semantics: region-sharded
    // dispatch with per-shard lock/timeout behavior.
    if (!scope) {
      const baseUrl = getBaseUrl(req);
      const canDispatch = Boolean(process.env.CRON_SECRET && baseUrl);

      // Local/dev convenience: allow Run all to work without cron secrets by
      // falling back to direct execution in-process.
      if (!canDispatch) {
        const result = await runPipeline('admin', undefined, runOptions);
        return NextResponse.json({
          ok: true,
          mode: 'direct',
          scope: null,
          result,
          note: 'Cron dispatch unavailable; ran direct fallback.',
        });
      }

      try {
        const dispatchRes = await fetch(`${baseUrl}/api/cron/pipeline/dispatch`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(runOptions),
        });

        const dispatchResTextClone = dispatchRes.clone();
        const dispatchPayload = await dispatchRes.json().catch(() => null);
        if (!dispatchRes.ok || !dispatchPayload?.ok) {
          const responseText = await dispatchResTextClone.text().catch(() => '');
          const detail =
            dispatchPayload?.error ??
            dispatchPayload?.reason ??
            (responseText.trim().length > 0 ? responseText.trim().slice(0, 240) : undefined) ??
            `${dispatchRes.status} ${dispatchRes.statusText}`.trim();
          throw new Error(`cron dispatch failed: ${detail}`);
        }

        return NextResponse.json({ ok: true, mode: 'dispatch', dispatch: dispatchPayload });
      } catch (dispatchErr) {
        console.warn('[admin/pipeline/run] cron dispatch failed; falling back to direct run', {
          error: dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr),
        });
        const result = await runPipeline('admin', undefined, runOptions);
        return NextResponse.json({
          ok: true,
          mode: 'direct-fallback',
          scope: null,
          result,
          note: 'Cron dispatch failed; ran direct fallback.',
        });
      }
    }

    const result = await runPipeline('admin', scope, runOptions);
    return NextResponse.json({ ok: true, mode: 'direct', scope: scope ?? null, result });
  } catch (err) {
    console.error('[admin/pipeline/run]', err);
    // Surface a more useful payload so the admin UI can pinpoint failures
    // without having to dig through Vercel function logs. Includes the error
    // name (e.g. TypeError, DOMException) and the first stack frame.
    const name = err instanceof Error ? err.constructor.name : typeof err;
    const message = err instanceof Error ? err.message : String(err);
    const firstFrame =
      err instanceof Error && typeof err.stack === 'string'
        ? (err.stack.split('\n').find((line) => line.trim().startsWith('at ')) ?? null)
        : null;
    return NextResponse.json(
      {
        ok: false,
        error: `${name}: ${message}${firstFrame ? ` (${firstFrame.trim()})` : ''}`,
      },
      { status: 500 },
    );
  }
}
