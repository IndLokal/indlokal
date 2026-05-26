/**
 * Postgres session-level advisory locks keyed by a string.
 *
 * Used by the cron route to prevent concurrent shard runs from racing on
 * fetch / extract / dedup work. Lock is held until `release()` is called
 * or the database session ends.
 *
 * Spec: docs/specs/TDD/0026-pipeline-reliability-hardening.md §4.1
 */

import { db } from '@/lib/db';

export type AdvisoryLock = {
  acquired: boolean;
  release: () => Promise<void>;
};

/**
 * Try to acquire a session-level advisory lock; returns immediately.
 * Safe to call from any Prisma session. Collision risk on the 64-bit hash
 * is negligible at the pipeline's call volume.
 */
export async function tryAdvisoryLock(key: string): Promise<AdvisoryLock> {
  const rows = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtextextended(${key}, 0)) AS locked
  `;
  const acquired = rows[0]?.locked === true;
  return {
    acquired,
    release: async () => {
      if (!acquired) return;
      try {
        await db.$executeRaw`SELECT pg_advisory_unlock(hashtextextended(${key}, 0))`;
      } catch (err) {
        console.warn(`[advisory-lock] release failed for key=${key}:`, String(err));
      }
    },
  };
}
