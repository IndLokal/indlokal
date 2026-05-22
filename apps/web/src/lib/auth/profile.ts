/**
 * Map a Prisma `User` row to the public `MeProfile` contract.
 * Centralizes the shape so handlers don't accidentally leak fields.
 */

import type { City, User } from '@prisma/client';
import type { auth } from '@indlokal/shared';

type UserWithCity = User & { city?: Pick<City, 'name'> | null };

export function toMeProfile(user: UserWithCity): auth.MeProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    cityId: user.cityId,
    cityName: user.city?.name ?? null,
    personaSegments: user.personaSegments,
    preferredLanguages: user.preferredLanguages,
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}
