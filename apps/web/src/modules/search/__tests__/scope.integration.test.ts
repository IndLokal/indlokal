import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createResource } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return {
    ...mod,
    db: testDb,
    resolveCityIds: async (citySlug: string) => {
      const city = await testDb.city.findUnique({
        where: { slug: citySlug },
        select: { id: true, satelliteCities: { select: { id: true } } },
      });
      if (!city) return [];
      return [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
    },
    resolveCityScopeParams: async (citySlug: string) => {
      const city = await testDb.city.findUnique({
        where: { slug: citySlug },
        select: {
          id: true,
          slug: true,
          state: true,
          metroRegion: { select: { slug: true } },
          satelliteCities: { select: { id: true, slug: true } },
        },
      });
      if (!city) return null;
      const cityIds = [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
      return {
        cityIds,
        slug: city.slug,
        state: city.state,
        metroSlug: city.metroRegion?.slug ?? null,
        satelliteSlugs: city.satelliteCities.map((s: { slug: string }) => s.slug),
      };
    },
  };
});

import { searchResources } from '@/modules/search/queries';

describe('resource scope resolution (state-scoped) @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('does not surface a STATE-scoped resource for an unrelated city', async () => {
    // Stuttgart (default fixture) - state: Baden-Württemberg
    const stuttgart = await createCity(testDb, { slug: 'stuttgart', name: 'Stuttgart' });
    // Munich in a different state (Bavaria)
    const munich = await createCity(testDb, { slug: 'munich', name: 'Munich', state: 'Bavaria' });

    // Create a STATE-scoped resource for Bavaria
    await createResource(testDb, {
      title: 'Bavaria state guide',
      scope: 'STATE',
      scopeRegion: 'Bavaria',
    });

    // Searching in Stuttgart should NOT find the Bavaria resource
    const resStuttgart = await searchResources(stuttgart.slug, 'Bavaria');
    expect(resStuttgart.some((r) => r.title.includes('Bavaria'))).toBe(false);

    // Searching in Munich SHOULD find the Bavaria resource
    const resMunich = await searchResources(munich.slug, 'Bavaria');
    expect(resMunich.some((r) => r.title.includes('Bavaria'))).toBe(true);
  });

  it('surfaces METRO-scoped resource for cities in the metro and not for others', async () => {
    // Create a metro primary and a satellite city
    const metroPrimary = await createCity(testDb, {
      slug: 'stuttgart-metro',
      name: 'Stuttgart Metro',
      state: 'Baden-Württemberg',
      isMetroPrimary: true,
    });
    const satellite = await createCity(testDb, {
      slug: 'esslingen',
      name: 'Esslingen',
      state: 'Baden-Württemberg',
      metroRegionId: metroPrimary.id,
      isMetroPrimary: false,
    });

    const otherCity = await createCity(testDb, {
      slug: 'other-city',
      name: 'OtherCity',
      state: 'Bavaria',
    });

    // Create a METRO-scoped resource scoped to the metro primary slug
    await createResource(testDb, {
      title: 'Stuttgart Metro Guide',
      scope: 'METRO',
      scopeRegion: metroPrimary.slug,
    });

    // Searching in the satellite should find the metro resource
    const resSatellite = await searchResources(satellite.slug, 'Stuttgart');
    expect(resSatellite.some((r) => r.title.includes('Stuttgart Metro'))).toBe(true);

    // Searching in an unrelated city should NOT find it
    const resOther = await searchResources(otherCity.slug, 'Stuttgart');
    expect(resOther.some((r) => r.title.includes('Stuttgart Metro'))).toBe(false);
  });

  it('surfaces CITY-scoped resource only for the matching city', async () => {
    const cityA = await createCity(testDb, { slug: 'city-a', name: 'City A', state: 'StateA' });
    const cityB = await createCity(testDb, { slug: 'city-b', name: 'City B', state: 'StateA' });

    await createResource(testDb, {
      title: 'City A Official Guide',
      scope: 'CITY',
      scopeRegion: cityA.slug,
    });

    const resA = await searchResources(cityA.slug, 'Official Guide');
    expect(resA.some((r) => r.title.includes('City A Official Guide'))).toBe(true);

    const resB = await searchResources(cityB.slug, 'Official Guide');
    expect(resB.some((r) => r.title.includes('City A Official Guide'))).toBe(false);
  });
});
