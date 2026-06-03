import { type NextRequest, NextResponse } from 'next/server';
import {
  enqueueWeeklyDigest,
  enqueueSavedEventReminders,
  processNotificationOutbox,
  defaultTransports,
} from '@/modules/notifications';

export const maxDuration = 120;

/**
 * Retention loop cron - PRD/TDD-0049.
 *
 * Runs the weekly-digest and saved-event-reminder producers, then drains the
 * notification outbox through the available transports. Gated by
 * RETENTION_PRODUCERS_ENABLED so the loop can ship dark and be flipped on.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.RETENTION_PRODUCERS_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'flag_disabled' });
  }

  try {
    const now = new Date();
    const digest = await enqueueWeeklyDigest(now);
    const reminders = await enqueueSavedEventReminders(now);
    const processed = await processNotificationOutbox({ transports: defaultTransports, now });

    return NextResponse.json({ ok: true, digest, reminders, processed });
  } catch (err) {
    console.error('[cron/retention]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
