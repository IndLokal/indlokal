import { type NextRequest, NextResponse } from 'next/server';
import { enrichSparseCommunities } from '@/modules/pipeline';

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await enrichSparseCommunities();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/enrichment]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
