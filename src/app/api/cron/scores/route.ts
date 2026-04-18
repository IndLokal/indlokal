import { type NextRequest, NextResponse } from 'next/server';
import { refreshAllScores } from '@/modules/scoring';
import { db } from '@/lib/db';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Refresh scores
    const { updated, demoted } = await refreshAllScores();

    // 2. Auto-archive past events (UPCOMING → PAST)
    const archived = await db.event.updateMany({
      where: {
        status: 'UPCOMING',
        startsAt: { lt: new Date() },
      },
      data: { status: 'PAST' },
    });

    return NextResponse.json({
      ok: true,
      scoresRefreshed: updated,
      communitiesDemoted: demoted,
      eventsArchived: archived.count,
    });
  } catch (err) {
    console.error('[cron/scores]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
