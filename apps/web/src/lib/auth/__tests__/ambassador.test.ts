import { describe, expect, it } from 'vitest';
import {
  getAmbassadorCityIds,
  getAuthorizedCityId,
  hasAmbassadorAllCitiesAccess,
} from '../ambassador';

describe('ambassador auth helpers', () => {
  it('collects active ambassador city scopes', () => {
    const user = {
      role: 'CITY_AMBASSADOR' as const,
      roleAssignments: [
        { role: 'CITY_AMBASSADOR' as const, cityId: 'city-1', orgId: null, revokedAt: null },
        {
          role: 'CITY_AMBASSADOR' as const,
          cityId: 'city-2',
          orgId: null,
          revokedAt: new Date(),
        },
        { role: 'OPS_LEAD' as const, cityId: null, orgId: null, revokedAt: null },
      ],
    };

    expect(getAmbassadorCityIds(user)).toEqual(['city-1']);
  });

  it('resolves the only allowed city when none is provided', () => {
    const user = {
      role: 'CITY_AMBASSADOR' as const,
      roleAssignments: [
        { role: 'CITY_AMBASSADOR' as const, cityId: 'city-1', orgId: null, revokedAt: null },
      ],
    };

    expect(getAuthorizedCityId(user, null)).toBe('city-1');
  });

  it('allows platform-wide ambassador preview roles to submit for a chosen city', () => {
    const user = {
      role: 'PLATFORM_ADMIN' as const,
      roleAssignments: [],
    };

    expect(hasAmbassadorAllCitiesAccess(user)).toBe(true);
    expect(getAuthorizedCityId(user, 'city-2')).toBe('city-2');
  });
});
