import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const channels = await db.accessChannel.findMany({
      where: {
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: oneDayAgo } }],
      },
      select: { id: true, url: true },
      take: 100,
    });

    let verified = 0;
    let broken = 0;

    for (let i = 0; i < channels.length; i += 10) {
      const batch = channels.slice(i, i + 10);
      await Promise.allSettled(
        batch.map(async (ch) => {
          const isReachable = await checkUrl(ch.url);
          await db.accessChannel.update({
            where: { id: ch.id },
            data: { isVerified: isReachable, lastVerifiedAt: new Date() },
          });
          if (isReachable) verified++;
          else broken++;
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      checked: channels.length,
      verified,
      broken,
    });
  } catch (err) {
    console.error('[cron/links]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  } catch {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    return res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
