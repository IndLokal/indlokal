/**
 * PATCH /api/v1/devices/:installationId — partial update (push token rotation, locale, etc.)
 * DELETE /api/v1/devices/:installationId — sign-out from this device.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { notifications as n } from '@indlokal/shared';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toDeviceContract } from '@/lib/notifications/devices';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ installationId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const { installationId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = n.DeviceUpdate.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  try {
    const device = await db.device.update({
      where: {
        userId_installationId: { userId: auth.user.userId, installationId },
      },
      data: {
        ...(parsed.data.platform !== undefined ? { platform: parsed.data.platform } : {}),
        ...(parsed.data.expoPushToken !== undefined
          ? { expoPushToken: parsed.data.expoPushToken }
          : {}),
        ...(parsed.data.locale !== undefined ? { locale: parsed.data.locale } : {}),
        ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
        ...(parsed.data.appVersion !== undefined ? { appVersion: parsed.data.appVersion } : {}),
        lastSeenAt: new Date(),
      },
    });
    return NextResponse.json(toDeviceContract(device));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return apiError('NOT_FOUND', 'device not registered for this user');
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const { installationId } = await ctx.params;

  await db.device.deleteMany({
    where: { userId: auth.user.userId, installationId },
  });

  return NextResponse.json({ ok: true });
}
