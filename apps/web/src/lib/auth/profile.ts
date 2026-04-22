/**
 * Map a Prisma `User` row to the public `MeProfile` contract.
 * Centralizes the shape so handlers don't accidentally leak fields.
 */

import type { User } from '@prisma/client';
import type { auth } from '@indlokal/shared';

export function toMeProfile(user: User): auth.MeProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    cityId: user.cityId,
    personaSegments: user.personaSegments,
    preferredLanguages: user.preferredLanguages,
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}
