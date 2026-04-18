import { type NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/modules/pipeline/orchestrator';

export const maxDuration = 300; // 5 min — pipeline can be slow

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[cron/pipeline]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
