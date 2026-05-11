/**
 * POST /api/v1/devices — TDD-0002 §3.
 *
 * Idempotent registration: upserts on (userId, installationId).
 * Mobile apps call this on first launch and again whenever the Expo
 * push token rotates.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { notifications as n } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toDeviceContract } from '@/lib/notifications/devices';
import { apiHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = n.DeviceRegister.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const data = {
    expoPushToken: parsed.data.expoPushToken ?? null,
    locale: parsed.data.locale ?? 'en',
    timezone: parsed.data.timezone ?? 'Europe/Berlin',
    appVersion: parsed.data.appVersion ?? null,
    lastSeenAt: new Date(),
  };

  const device = await db.device.upsert({
    where: {
      userId_installationId: {
        userId: auth.user.userId,
        installationId: parsed.data.installationId,
      },
    },
    create: {
      userId: auth.user.userId,
      installationId: parsed.data.installationId,
      platform: parsed.data.platform,
      ...data,
    },
    update: {
      // platform is immutable post-creation — ignore it on update.
      ...data,
    },
  });

  return NextResponse.json(toDeviceContract(device));
});
