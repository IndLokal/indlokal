import { type NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/modules/pipeline';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

export const maxDuration = 300; // 5 min — pipeline can be slow

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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const citySlugs = parseScopeParam(url, 'city');
  const regionIds = parseScopeParam(url, 'region');

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
    });

    return NextResponse.json({ ok: true, scope: scope ?? null, result });
  } catch (err) {
    console.error('[cron/pipeline]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
