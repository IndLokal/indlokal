/**
 * Notification outbox module — TDD-0002.
 *
 * Two pure-ish entry points:
 *
 * - `enqueueNotification` — producer; inserts a row into NotificationOutbox
 *   with an idempotency key.
 * - `processNotificationOutbox` — consumer; claims pending rows, applies
 *   per-user preferences and quiet-hours filters, dispatches to the
 *   appropriate channel transport, and marks rows SENT/SUPPRESSED/FAILED.
 *
 * The real Expo / Resend transports live in `./transports.ts`; this file
 * only wires the orchestration so it can be unit tested with stubs.
 */

import { db } from '@/lib/db';
import {
  type NotificationChannel,
  type NotificationStatus,
  type NotificationTopic,
  Prisma,
} from '@prisma/client';

export type EnqueueInput = {
  userId: string;
  topic: NotificationTopic;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
  /** Idempotency key — typically `${topic}:${entityId}:${userId}` */
  idempotencyKey: string;
  notBefore?: Date;
  scoreAtEnqueue?: number;
};

export async function enqueueNotification(input: EnqueueInput) {
  return db.notificationOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      topic: input.topic,
      channel: input.channel,
      payload: input.payload as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      notBefore: input.notBefore,
      scoreAtEnqueue: input.scoreAtEnqueue,
    },
    update: {}, // no-op: same idempotency key means we already enqueued
  });
}

// ─── Quiet-hours helper (pure) ─────────────────────────────────────────────

/**
 * Returns true if the given Date falls inside the user's quiet-hours window.
 * `startMin`/`endMin` are minutes since midnight in the user's timezone;
 * the window may wrap midnight (e.g. 22:00 → 08:00).
 */
export function isQuietHours(
  now: Date,
  quiet: { startMin: number; endMin: number; timezone: string },
): boolean {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: quiet.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const localMin = hour * 60 + minute;

  if (quiet.startMin === quiet.endMin) return false;
  if (quiet.startMin < quiet.endMin) {
    return localMin >= quiet.startMin && localMin < quiet.endMin;
  }
  // Wraps midnight.
  return localMin >= quiet.startMin || localMin < quiet.endMin;
}

// ─── Outbox processor ──────────────────────────────────────────────────────

export type Transport = (row: {
  id: string;
  userId: string;
  topic: NotificationTopic;
  channel: NotificationChannel;
  payload: unknown;
}) => Promise<void>;

export type ProcessOptions = {
  /** Cap how many rows we claim per tick. Defaults to 50. */
  batchSize?: number;
  /** Override `Date.now()` for tests. */
  now?: Date;
  /** Per-channel transport; if absent for a channel, that row is FAILED. */
  transports: Partial<Record<NotificationChannel, Transport>>;
};

type ProcessResult = {
  claimed: number;
  sent: number;
  suppressed: number;
  failed: number;
};

/**
 * Claim a batch of PENDING outbox rows whose `scheduledAt` (or `notBefore`)
 * has passed, then dispatch them respecting user preferences + quiet hours.
 *
 * Designed to be invoked by a cron / `pg-boss` worker. No external scheduler
 * is imported here so the function stays unit-testable.
 */
export async function processNotificationOutbox(opts: ProcessOptions): Promise<ProcessResult> {
  const batchSize = opts.batchSize ?? 50;
  const now = opts.now ?? new Date();

  const claimed = await db.notificationOutbox.findMany({
    where: {
      status: 'PENDING',
      OR: [{ notBefore: null }, { notBefore: { lte: now } }],
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: batchSize,
  });

  const result: ProcessResult = { claimed: claimed.length, sent: 0, suppressed: 0, failed: 0 };

  for (const row of claimed) {
    // Read user preferences + quiet hours together.
    const [pref, quiet] = await Promise.all([
      db.notificationPreference.findUnique({
        where: {
          userId_topic_channel: {
            userId: row.userId,
            topic: row.topic,
            channel: row.channel,
          },
        },
      }),
      db.quietHours.findUnique({ where: { userId: row.userId } }),
    ]);

    // Default to enabled if the user never toggled this preference.
    const enabled = pref?.enabled ?? true;
    const inQuiet = quiet ? isQuietHours(now, quiet) : false;

    if (!enabled || (inQuiet && row.channel === 'PUSH')) {
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SUPPRESSED' satisfies NotificationStatus },
      });
      result.suppressed += 1;
      continue;
    }

    const transport = opts.transports[row.channel];
    if (!transport) {
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: 'FAILED' satisfies NotificationStatus,
          lastError: `no transport configured for channel ${row.channel}`,
          attempts: { increment: 1 },
        },
      });
      result.failed += 1;
      continue;
    }

    try {
      await transport({
        id: row.id,
        userId: row.userId,
        topic: row.topic,
        channel: row.channel,
        payload: row.payload,
      });
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: 'SENT' satisfies NotificationStatus,
          sentAt: now,
          attempts: { increment: 1 },
        },
      });
      result.sent += 1;
    } catch (err) {
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: {
          lastError: err instanceof Error ? err.message : String(err),
          attempts: { increment: 1 },
          // Stay PENDING for retry until attempts exceed cap (handled by caller).
        },
      });
      result.failed += 1;
    }
  }

  return result;
}
