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

    // 2. Auto-archive past events (UPCOMING → PAST).
    //
    //    Lifecycle rule: an event is PAST when it has *finished*, not when it
    //    has *started*. A 3-day Diwali fest that started yesterday must remain
    //    UPCOMING until its endsAt is in the past.
    //
    //    • If endsAt is set: flip when endsAt < now.
    //    • If endsAt is null: assume a 4-hour duration from startsAt. This is
    //      a pragmatic default — most community events are 2–4 hours and
    //      organisers frequently omit endsAt. Tweaks happen via organiser edits.
    const now = new Date();
    const noEndsAtCutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const archived = await db.event.updateMany({
      where: {
        status: 'UPCOMING',
        OR: [
          { endsAt: { lt: now } },
          { AND: [{ endsAt: null }, { startsAt: { lt: noEndsAtCutoff } }] },
        ],
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
