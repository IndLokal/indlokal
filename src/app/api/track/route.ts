import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import type { InteractionEntityType } from '@prisma/client';

const VALID_ENTITY_TYPES = new Set<string>(['COMMUNITY', 'EVENT', 'RESOURCE']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityType, entityId, cityId } = body as {
      entityType: string;
      entityId: string;
      cityId: string;
    };

    // Basic input validation
    if (!entityType || !entityId || !VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ ok: true }); // silently ignore bad input
    }

    // Optional user resolution via session cookie
    const jar = await cookies();
    const token = jar.get('lp_session')?.value;
    let userId: string | null = null;
    if (token) {
      const user = await db.user.findUnique({
        where: { sessionToken: token },
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
  } catch {
    // Non-critical telemetry — swallow all errors
  }

  return NextResponse.json({ ok: true });
}
