import type { SessionUser } from './permissions';

type AmbassadorScopedUser = Pick<SessionUser, 'role' | 'roleAssignments'>;

export function getAmbassadorCityIds(user: AmbassadorScopedUser): string[] {
  return user.roleAssignments
    .filter(
      (assignment) =>
        assignment.role === 'CITY_AMBASSADOR' && assignment.cityId && !assignment.revokedAt,
    )
    .map((assignment) => assignment.cityId as string);
}

export function hasAmbassadorAllCitiesAccess(user: AmbassadorScopedUser): boolean {
  return user.role === 'PLATFORM_ADMIN' || user.role === 'OPS_LEAD';
}

export function getAuthorizedCityId(
  user: AmbassadorScopedUser,
  cityId: string | null,
): string | null {
  const allowedCityIds = getAmbassadorCityIds(user);

  if (allowedCityIds.length === 0) {
    return hasAmbassadorAllCitiesAccess(user) ? cityId : null;
  }

  if (cityId) {
    return allowedCityIds.includes(cityId) ? cityId : null;
  }

  return allowedCityIds.length === 1 ? allowedCityIds[0] : null;
}
