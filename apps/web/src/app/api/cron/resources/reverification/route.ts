import { type NextRequest, NextResponse } from 'next/server';
import { ingestReverificationQueue } from '@/modules/resources/reverification';
import { FLAGS } from '@/lib/config/flags';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!FLAGS.resourcesReverificationQueueEnabled) {
    return NextResponse.json({ ok: true, skipped: 'flag_disabled' });
  }

  try {
    const result = await ingestReverificationQueue(new Date());
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[cron/resources/reverification]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
