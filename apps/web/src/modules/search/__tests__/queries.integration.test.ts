/**
 * Integration tests for search queries.
 *
 * Validates that search correctly finds communities and events,
 * handles edge cases, and doesn't crash on special characters.
 *
 * @db - requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent, createResource } from '@/test/fixtures';

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

import {
  searchCommunities,
  searchEvents,
  searchResources,
  searchAll,
} from '@/modules/search/queries';

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

    // These should not throw - SQL injection or syntax error would cause failure
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

// ── PRD/TDD-0048: resources in unified search ────────────────────────────────

describe('searchResources @db', () => {
  let citySlug: string;
  let cityId: string;

  beforeEach(async () => {
    await cleanDb();
    const city = await createCity(testDb, {
      slug: 'search-resource-city',
      name: 'SearchResourceCity',
    });
    citySlug = city.slug;
    cityId = city.id;
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('returns empty for short queries', async () => {
    expect(await searchResources(citySlug, 'x')).toEqual([]);
    expect(await searchResources(citySlug, '')).toEqual([]);
  });

  it('finds national resources by title (no city scope needed)', async () => {
    await createResource(testDb, {
      title: 'Anmeldung registration guide',
      description: 'Register your address in Germany.',
    });

    const results = await searchResources(undefined, 'Anmeldung');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain('Anmeldung');
  });

  it('includes national resources even when a city is given', async () => {
    await createResource(testDb, {
      title: 'Tax finance Anmeldung help',
      cityId: null,
    });

    const results = await searchResources(citySlug, 'Anmeldung');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes hidden resources', async () => {
    await createResource(testDb, {
      title: 'Hidden Anmeldung secret',
      isHidden: true,
    });

    const results = await searchResources(undefined, 'Anmeldung');
    expect(results.find((r) => r.title.includes('Hidden'))).toBeUndefined();
  });

  it('does not crash on special characters', async () => {
    const specialQueries = ["it's", 'test & more', '<script>', "'; DROP TABLE", '(brackets)'];
    for (const q of specialQueries) {
      const results = await searchResources(undefined, q);
      expect(Array.isArray(results)).toBe(true);
    }
    expect(citySlug).toBeTruthy();
    expect(cityId).toBeTruthy();
  });
});

// ── PRD/TDD-0048: unified searchAll spanning entity kinds + national scope ────

describe('searchAll unified @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('returns communities, events and resources together (national scope)', async () => {
    const city = await createCity(testDb, { slug: 'unified-city', name: 'UnifiedCity' });
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await createCommunity(testDb, {
      cityId: city.id,
      name: 'Diwali Lovers Community',
      slug: 'diwali-community',
    });
    await createEvent(testDb, {
      cityId: city.id,
      title: 'Diwali Gala',
      slug: 'diwali-gala',
      startsAt: nextWeek,
    });
    await createResource(testDb, { title: 'Diwali fireworks rules', cityId: null });

    // No city slug → all of Germany.
    const { items } = await searchAll({ q: 'Diwali', limit: 20 });
    const kinds = new Set(items.map((i) => i.type));
    expect(kinds.has('COMMUNITY')).toBe(true);
    expect(kinds.has('EVENT')).toBe(true);
    expect(kinds.has('RESOURCE')).toBe(true);
  });

  it('national community search spans multiple cities', async () => {
    const berlin = await createCity(testDb, { slug: 'unified-berlin', name: 'UnifiedBerlin' });
    const munich = await createCity(testDb, { slug: 'unified-munich', name: 'UnifiedMunich' });
    await createCommunity(testDb, {
      cityId: berlin.id,
      name: 'Telugu Berlin Circle',
      slug: 'telugu-berlin-circle',
    });
    await createCommunity(testDb, {
      cityId: munich.id,
      name: 'Telugu Munich Circle',
      slug: 'telugu-munich-circle',
    });

    const results = await searchCommunities(undefined, 'Telugu');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
