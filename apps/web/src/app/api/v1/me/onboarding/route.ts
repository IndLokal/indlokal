/**
 * PATCH /api/v1/me/onboarding — PRD-0019 / TDD-0019.
 *
 * Persists the user's city, persona segments, preferred languages, and
 * optional display name collected during the mobile onboarding flow.
 * Always sets onboardingComplete = true on success so the client can
 * route to the main tab loop.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const PATCH = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.OnboardingUpdate.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const { cityId, displayName, personaSegments, preferredLanguages } = parsed.data;

  // Validate cityId against an active city if provided.
  if (cityId) {
    const city = await db.city.findUnique({
      where: { id: cityId },
      select: { id: true, isActive: true },
    });
    if (!city || !city.isActive) {
      return apiError('BAD_REQUEST', 'cityId does not refer to an active city');
    }
  }

  const user = await db.user.update({
    where: { id: auth.user.userId },
    data: {
      ...(cityId !== undefined && { cityId }),
      ...(displayName !== undefined && { displayName }),
      ...(personaSegments !== undefined && { personaSegments }),
      ...(preferredLanguages !== undefined && { preferredLanguages }),
      onboardingComplete: true,
      lastActiveAt: new Date(),
    },
    include: { city: { select: { name: true } } },
  });

  return NextResponse.json(toMeProfile(user));
});
