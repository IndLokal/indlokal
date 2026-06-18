/**
 * Map a Prisma `User` row to the public `MeProfile` contract.
 * Centralizes the shape so handlers don't accidentally leak fields.
 */

import type { City, User } from '@prisma/client';
import type { auth } from '@indlokal/shared';

type UserWithCity = User & {
  city?: Pick<City, 'name'> | null;
  roleAssignments?: Array<{
    role: auth.UserRole;
    cityId: string | null;
    orgId: string | null;
    revokedAt: Date | null;
  }>;
  claimedCommunities?: Array<{ id: string; claimedByUserId: string | null }>;
};

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
    roleAssignments: (user.roleAssignments ?? []).map((a) => ({
      role: a.role,
      cityId: a.cityId,
      orgId: a.orgId,
      revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
    })),
    claimedCommunities: (user.claimedCommunities ?? []).map((c) => ({
      id: c.id,
      claimedByUserId: c.claimedByUserId,
    })),
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}
