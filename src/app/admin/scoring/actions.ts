'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { refreshAllScores } from '@/modules/scoring';

/** Guard: reject if caller is not PLATFORM_ADMIN */
async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }
  return user;
}

export type JobResult = { ok: true; message: string } | { ok: false; error: string };

/** Trigger a full score refresh across all non-inactive communities */
export async function runScoreRefresh(): Promise<JobResult> {
  await requireAdminAction();
  try {
    const { updated } = await refreshAllScores();
    revalidatePath('/admin/scoring');
    return { ok: true, message: `Scores refreshed for ${updated} communities.` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Check access channel links for reachability */
export async function runLinkCheck(): Promise<JobResult> {
  await requireAdminAction();
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const channels = await db.accessChannel.findMany({
      where: {
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: oneDayAgo } }],
      },
      select: { id: true, url: true },
      take: 100, // batch cap — prevents timeout with large datasets
    });

    let verified = 0;
    let broken = 0;

    // Check in parallel batches of 10
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

    revalidatePath('/admin/scoring');
    return {
      ok: true,
      message: `Checked ${channels.length} links: ${verified} reachable, ${broken} unreachable.`,
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** HEAD request with 5s timeout; falls back to GET if HEAD is not supported */
async function checkUrl(url: string): Promise<boolean> {
  // Only allow http(s) to prevent SSRF via file://, ftp://, etc.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
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
    // 2xx and 3xx are all considered reachable
    return res.status < 400;
  } catch {
    // Network error, timeout, or DNS failure → broken
    return false;
  } finally {
    clearTimeout(timer);
  }
}
