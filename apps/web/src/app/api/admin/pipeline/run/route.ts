import { type NextRequest, NextResponse } from 'next/server';
import { assertCan } from '@/lib/auth/permissions';
import { runPipeline, type PipelineRunScope } from '@/modules/pipeline';

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

export async function POST(req: NextRequest) {
  try {
    await assertCan('pipeline.run');

    const body = ((await req.json().catch(() => null)) ?? {}) as {
      regionIds?: unknown;
      citySlugs?: unknown;
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

    // Align "Run all enabled regions" with cron semantics: region-sharded
    // dispatch with per-shard lock/timeout behavior.
    if (!scope) {
      if (!process.env.CRON_SECRET) {
        throw new Error('CRON_SECRET is not configured; cannot dispatch sharded cron runs');
      }

      const baseUrl = getBaseUrl(req);
      if (!baseUrl) {
        throw new Error('Cannot resolve APP_URL/Host for cron dispatch');
      }

      const dispatchRes = await fetch(`${baseUrl}/api/cron/pipeline/dispatch`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          'content-type': 'application/json',
        },
      });

      const dispatchPayload = await dispatchRes.json().catch(() => null);
      if (!dispatchRes.ok || !dispatchPayload?.ok) {
        throw new Error(
          `cron dispatch failed: ${
            dispatchPayload?.error ?? dispatchPayload?.reason ?? dispatchRes.statusText
          }`,
        );
      }

      return NextResponse.json({ ok: true, mode: 'dispatch', dispatch: dispatchPayload });
    }

    const result = await runPipeline('admin', scope);
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
