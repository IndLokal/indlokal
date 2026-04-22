/**
 * Devices + Notifications contracts — TDD-0002.
 *
 * Schemas live here so the mobile app and the web Next.js handlers
 * import the exact same shapes (ADR-0002).
 */

import { z } from 'zod';
import { Ack, Cuid, IsoDateTime, Page } from './common';

// ─── Devices (TDD-0002 §2) ───────────────────────────────────────────

export const DevicePlatform = z.enum(['IOS', 'ANDROID', 'WEB']);
export type DevicePlatform = z.infer<typeof DevicePlatform>;

/**
 * `installationId` is generated client-side per app install (e.g. via
 * `expo-application.installationId`). It's stable across launches but
 * NOT a secret — the (userId, installationId) pair is the natural key.
 */
export const DeviceRegister = z.object({
  installationId: z.string().min(1).max(128),
  platform: DevicePlatform,
  expoPushToken: z.string().min(1).max(256).optional(),
  locale: z.string().min(2).max(16).optional(),
  timezone: z.string().min(1).max(64).optional(),
  appVersion: z.string().max(32).optional(),
});
export type DeviceRegister = z.infer<typeof DeviceRegister>;

export const DeviceUpdate = DeviceRegister.partial().omit({ installationId: true });
export type DeviceUpdate = z.infer<typeof DeviceUpdate>;

export const Device = z.object({
  id: Cuid,
  installationId: z.string(),
  platform: DevicePlatform,
  expoPushToken: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  appVersion: z.string().nullable(),
  lastSeenAt: IsoDateTime,
  createdAt: IsoDateTime,
});
export type Device = z.infer<typeof Device>;

// ─── Notification preferences (TDD-0002 §2, §3) ──────────────────────

export const NotificationTopic = z.enum([
  'CITY_NEW_EVENT',
  'COMMUNITY_UPDATE',
  'SAVED_EVENT_REMINDER',
  'FESTIVAL',
  'WEEKLY_DIGEST',
  'ORGANIZER_RSVP',
  'ORGANIZER_SUBMISSION',
  'REENGAGEMENT',
]);
export type NotificationTopic = z.infer<typeof NotificationTopic>;

export const NotificationChannel = z.enum(['PUSH', 'EMAIL', 'INBOX']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationPreferenceItem = z.object({
  topic: NotificationTopic,
  channel: NotificationChannel,
  enabled: z.boolean(),
});
export type NotificationPreferenceItem = z.infer<typeof NotificationPreferenceItem>;

/**
 * Quiet hours are stored as minutes-since-midnight in the user's
 * timezone. `start > end` is valid and means the window crosses
 * midnight (the default 22:00 → 08:00 case).
 */
export const QuietHours = z.object({
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(0).max(1439),
  timezone: z.string().min(1).max(64),
});
export type QuietHours = z.infer<typeof QuietHours>;

export const NotificationPreferences = z.object({
  preferences: z.array(NotificationPreferenceItem),
  quietHours: QuietHours,
});
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

export const NotificationPreferencesUpdate = z.object({
  preferences: z.array(NotificationPreferenceItem).optional(),
  quietHours: QuietHours.partial().optional(),
});
export type NotificationPreferencesUpdate = z.infer<typeof NotificationPreferencesUpdate>;

// ─── Inbox (TDD-0002 §2, §3) ─────────────────────────────────────────

export const InboxItem = z.object({
  id: Cuid,
  topic: NotificationTopic,
  title: z.string(),
  body: z.string(),
  deepLink: z.string().nullable(),
  readAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type InboxItem = z.infer<typeof InboxItem>;

export const InboxPage = Page(InboxItem);
export type InboxPage = z.infer<typeof InboxPage>;

export const InboxReadRequest = z.object({
  ids: z.array(Cuid).min(1).max(100),
});
export type InboxReadRequest = z.infer<typeof InboxReadRequest>;

export const InboxReadResponse = Ack;
export type InboxReadResponse = z.infer<typeof InboxReadResponse>;
