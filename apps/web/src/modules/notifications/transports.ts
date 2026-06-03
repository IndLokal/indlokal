/**
 * Notification channel transports - PRD/TDD-0049.
 *
 * Only the in-app INBOX transport is wired today: it materialises an
 * InboxItem the user sees in their inbox. PUSH/EMAIL transports require
 * external credentials (Expo / Resend) and are intentionally omitted until
 * those land - the outbox consumer simply leaves unconfigured channels
 * untouched (no rows are enqueued for them by current producers).
 */

import { db } from '@/lib/db';
import type { NotificationTopic } from '@prisma/client';
import type { Transport } from './outbox';

type InboxPayload = {
  title?: unknown;
  body?: unknown;
  deepLink?: unknown;
};

const inboxTransport: Transport = async (row) => {
  const payload = (row.payload ?? {}) as InboxPayload;
  await db.inboxItem.create({
    data: {
      userId: row.userId,
      topic: row.topic as NotificationTopic,
      title: typeof payload.title === 'string' ? payload.title : 'Update',
      body: typeof payload.body === 'string' ? payload.body : '',
      deepLink: typeof payload.deepLink === 'string' ? payload.deepLink : null,
    },
  });
};

export const defaultTransports = {
  INBOX: inboxTransport,
} as const;
