/**
 * Integration tests for search queries.
 *
 * Validates that search correctly finds communities and events,
 * handles edge cases, and doesn't crash on special characters.
 *
 * @db — requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent } from '@/test/fixtures';

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

import { searchCommunities, searchEvents } from '@/modules/search/queries';

describe('searchCommunities @db', () => {
  let citySlug: string;
  let cityId: string;

  beforeEach(async () => {
    await cleanDb();
    const city = await createCity(testDb, { slug: 'search-test-city', name: 'SearchTestCity' });
    citySlug = city.slug;
    cityId = city.id;
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('returns empty for queries shorter than 2 characters', async () => {
    const results = await searchCommunities(citySlug, 'a');
    expect(results).toEqual([]);
  });

  it('returns empty for empty/whitespace query', async () => {
    expect(await searchCommunities(citySlug, '')).toEqual([]);
    expect(await searchCommunities(citySlug, '   ')).toEqual([]);
  });

  it('finds communities by name', async () => {
    await createCommunity(testDb, {
      cityId,
      name: 'Telugu Association Stuttgart',
      slug: 'telugu-association',
    });

    const results = await searchCommunities(citySlug, 'Telugu');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toContain('Telugu');
  });

  it('finds communities by description (ILIKE fallback)', async () => {
    await createCommunity(testDb, {
      cityId,
      name: 'South Indian Group',
      slug: 'south-indian',
      description: 'A community for Kannada speakers in the Stuttgart region.',
    });

    const results = await searchCommunities(citySlug, 'Kannada');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('does not return INACTIVE communities', async () => {
    await createCommunity(testDb, {
      cityId,
      name: 'Inactive Telugu Group',
      slug: 'inactive-telugu',
      status: 'INACTIVE',
    });

    const results = await searchCommunities(citySlug, 'Telugu');
    expect(results).toEqual([]);
  });

  it('does not crash on special characters', async () => {
    await createCommunity(testDb, { cityId });

    // These should not throw — SQL injection or syntax error would cause failure
    const specialQueries = [
      "it's",
      'test & more',
      '<script>alert(1)</script>',
      "'; DROP TABLE community; --",
      '(brackets)',
      'query | with | pipes',
      '50%',
    ];

    for (const q of specialQueries) {
      const results = await searchCommunities(citySlug, q);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('does not find communities from other cities', async () => {
    const otherCity = await createCity(testDb, { slug: 'search-other-city', name: 'OtherCity' });
    await createCommunity(testDb, {
      cityId: otherCity.id,
      name: 'Telugu Association Berlin',
      slug: 'telugu-berlin',
    });

    const results = await searchCommunities(citySlug, 'Telugu');
    expect(results).toEqual([]);
  });
});

describe('searchEvents @db', () => {
  let citySlug: string;
  let cityId: string;

  beforeEach(async () => {
    await cleanDb();
    const city = await createCity(testDb, { slug: 'search-event-city', name: 'SearchEventCity' });
    citySlug = city.slug;
    cityId = city.id;
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('returns empty for short queries', async () => {
    expect(await searchEvents(citySlug, 'x')).toEqual([]);
    expect(await searchEvents(citySlug, '')).toEqual([]);
  });

  it('finds upcoming events by title', async () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await createEvent(testDb, {
      cityId,
      title: 'Diwali Night Stuttgart',
      slug: 'diwali-night',
      startsAt: nextWeek,
    });

    const results = await searchEvents(citySlug, 'Diwali');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain('Diwali');
  });

  it('does not return past events', async () => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await createEvent(testDb, {
      cityId,
      title: 'Past Diwali Night',
      slug: 'past-diwali',
      startsAt: lastWeek,
    });

    const results = await searchEvents(citySlug, 'Diwali');
    expect(results).toEqual([]);
  });

  it('does not crash on special characters', async () => {
    const specialQueries = ["it's", 'test & more', '<script>', "'; DROP TABLE", '(brackets)'];

    for (const q of specialQueries) {
      const results = await searchEvents(citySlug, q);
      expect(Array.isArray(results)).toBe(true);
    }
  });
});
