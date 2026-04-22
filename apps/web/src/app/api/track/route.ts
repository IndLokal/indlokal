import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { checkRateLimit, trackLimiter } from '@/lib/rate-limit';
import type { InteractionEntityType } from '@prisma/client';

const VALID_ENTITY_TYPES = new Set<string>(['COMMUNITY', 'EVENT', 'RESOURCE']);

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(trackLimiter, ip);
    if (!rl.allowed) {
      return NextResponse.json({ ok: true }); // silently drop — non-critical telemetry
    }

    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    const { entityType, entityId, cityId } = body as {
      entityType: string;
      entityId: string;
      cityId: string;
    };

    // Basic input validation
    if (!entityType || !entityId || !VALID_ENTITY_TYPES.has(entityType)) {
      console.warn('[track] Invalid input — entityType=%s entityId=%s', entityType, entityId);
      return NextResponse.json({ ok: true });
    }

    // Optional user resolution via session cookie
    const jar = await cookies();
    const rawToken = jar.get('lp_session')?.value;
    let userId: string | null = null;
    if (rawToken) {
      const hashed = await hashToken(rawToken);
      const user = await db.user.findUnique({
        where: { sessionToken: hashed },
        select: { id: true, sessionTokenExpiry: true },
      });
      if (user?.sessionTokenExpiry && user.sessionTokenExpiry > new Date()) {
        userId = user.id;
      }
    }

    // Optional city resolution
    let resolvedCityId: string | null = null;
    if (cityId) {
      const city = await db.city.findUnique({
        where: { id: cityId },
        select: { id: true },
      });
      resolvedCityId = city?.id ?? null;
    }

    await db.userInteraction.create({
      data: {
        entityType: entityType as InteractionEntityType,
        entityId,
        interactionType: 'VIEW',
        ...(userId && { userId }),
        ...(resolvedCityId && { cityId: resolvedCityId }),
      },
    });
  } catch (err) {
    // Non-critical telemetry — don't surface to client but log for debugging
    console.error('[track] Failed to record interaction:', err);
  }

  return NextResponse.json({ ok: true });
}
