/**
 * Notification-preference helpers — TDD-0002 §2.
 *
 * The Prisma model stores ONLY rows the user has touched. A missing
 * (topic, channel) pair is treated as "enabled" — that's the product
 * default per PRD-0004. This helper materializes the full matrix so
 * the API always returns a complete `NotificationPreferences` shape.
 */

import { db } from '@/lib/db';
import { notifications as n } from '@indlokal/shared';
import type { NotificationPreference, QuietHours as QuietHoursRow } from '@prisma/client';

const ALL_TOPICS = n.NotificationTopic.options;
const ALL_CHANNELS = n.NotificationChannel.options;

const DEFAULT_QUIET_HOURS: n.QuietHours = {
  startMin: 22 * 60,
  endMin: 8 * 60,
  timezone: 'Europe/Berlin',
};

export function materializePreferences(
  rows: Pick<NotificationPreference, 'topic' | 'channel' | 'enabled'>[],
): n.NotificationPreferenceItem[] {
  const byKey = new Map<string, boolean>();
  for (const row of rows) byKey.set(`${row.topic}:${row.channel}`, row.enabled);

  const result: n.NotificationPreferenceItem[] = [];
  for (const topic of ALL_TOPICS) {
    for (const channel of ALL_CHANNELS) {
      result.push({
        topic,
        channel,
        enabled: byKey.get(`${topic}:${channel}`) ?? true,
      });
    }
  }
  return result;
}

export function toQuietHoursContract(row: QuietHoursRow | null): n.QuietHours {
  if (!row) return DEFAULT_QUIET_HOURS;
  return { startMin: row.startMin, endMin: row.endMin, timezone: row.timezone };
}

export async function getNotificationPreferences(
  userId: string,
): Promise<n.NotificationPreferences> {
  const [rows, quiet] = await Promise.all([
    db.notificationPreference.findMany({
      where: { userId },
      select: { topic: true, channel: true, enabled: true },
    }),
    db.quietHours.findUnique({ where: { userId } }),
  ]);
  return {
    preferences: materializePreferences(rows),
    quietHours: toQuietHoursContract(quiet),
  };
}

export async function updateNotificationPreferences(
  userId: string,
  patch: n.NotificationPreferencesUpdate,
): Promise<n.NotificationPreferences> {
  const ops = [];

  if (patch.preferences && patch.preferences.length > 0) {
    for (const pref of patch.preferences) {
      ops.push(
        db.notificationPreference.upsert({
          where: {
            userId_topic_channel: {
              userId,
              topic: pref.topic,
              channel: pref.channel,
            },
          },
          create: { userId, topic: pref.topic, channel: pref.channel, enabled: pref.enabled },
          update: { enabled: pref.enabled },
        }),
      );
    }
  }

  if (patch.quietHours) {
    const existing = await db.quietHours.findUnique({ where: { userId } });
    const merged = {
      startMin: patch.quietHours.startMin ?? existing?.startMin ?? DEFAULT_QUIET_HOURS.startMin,
      endMin: patch.quietHours.endMin ?? existing?.endMin ?? DEFAULT_QUIET_HOURS.endMin,
      timezone: patch.quietHours.timezone ?? existing?.timezone ?? DEFAULT_QUIET_HOURS.timezone,
    };
    ops.push(
      db.quietHours.upsert({
        where: { userId },
        create: { userId, ...merged },
        update: merged,
      }),
    );
  }

  if (ops.length > 0) await db.$transaction(ops);
  return getNotificationPreferences(userId);
}
