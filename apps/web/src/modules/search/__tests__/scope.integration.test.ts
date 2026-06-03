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
});
