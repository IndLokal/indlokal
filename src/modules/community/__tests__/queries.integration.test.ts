/**
 * Integration tests — community module queries.
 *
 * @db — requires test database.
 * Prerequisites: `./dev.sh test:setup`
 *
 * These tests run against `localpulse_test` (isolated from dev data).
 * Each test starts with a clean database via beforeEach.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity } from '@/test/fixtures';

// Redirect the module-level `db` singleton to the test database
// so query functions operate on localpulse_test instead of localpulse.
vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  // Replace db and rebuild resolveCityIds to use testDb
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

import { getCommunityBySlug, getCommunityRedirectTarget, getCommunitiesByCity } from '../index';

// ─── Test setup ──────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ─── getCommunityBySlug ──────────────────────────────────────────────────────

describe('getCommunityBySlug', () => {
  it('returns null for a slug that does not exist', async () => {
    const result = await getCommunityBySlug('does-not-exist');
    expect(result).toBeNull();
  });

  it('returns the community when found by slug', async () => {
    const city = await createCity(testDb);
    await createCommunity(testDb, {
      slug: 'hss-stuttgart',
      name: 'HSS Stuttgart',
      cityId: city.id,
    });

    const result = await getCommunityBySlug('hss-stuttgart');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('HSS Stuttgart');
  });

  it('does not return INACTIVE communities', async () => {
    const city = await createCity(testDb);
    await createCommunity(testDb, {
      slug: 'old-group',
      cityId: city.id,
      status: 'INACTIVE',
    });

    const result = await getCommunityBySlug('old-group');
    expect(result).toBeNull();
  });

  it('returns redirect target for merged inactive communities', async () => {
    const city = await createCity(testDb);
    const primary = await createCommunity(testDb, {
      slug: 'new-group',
      name: 'New Group',
      cityId: city.id,
    });
    await createCommunity(testDb, {
      slug: 'old-group',
      name: 'Old Group',
      cityId: city.id,
      status: 'INACTIVE',
      mergedIntoId: primary.id,
      redirectSlug: primary.slug,
    });

    const redirectTarget = await getCommunityRedirectTarget('old-group');
    expect(redirectTarget).toEqual({ citySlug: city.slug, slug: 'new-group' });
  });
});

// ─── getCommunitiesByCity ─────────────────────────────────────────────────────

describe('getCommunitiesByCity', () => {
  it('returns empty array when city has no communities', async () => {
    await createCity(testDb, { slug: 'munich', name: 'Munich' });
    const result = await getCommunitiesByCity('munich');
    expect(result).toHaveLength(0);
  });

  it('returns communities sorted by activityScore descending', async () => {
    const city = await createCity(testDb);
    await createCommunity(testDb, { slug: 'low', cityId: city.id, activityScore: 10 });
    await createCommunity(testDb, { slug: 'high', cityId: city.id, activityScore: 80 });
    await createCommunity(testDb, { slug: 'mid', cityId: city.id, activityScore: 45 });

    const result = await getCommunitiesByCity('stuttgart');
    expect(result[0].activityScore).toBe(80);
    expect(result[2].activityScore).toBe(10);
  });

  it('returns notFound() for an unknown city slug', async () => {
    const result = await getCommunitiesByCity('does-not-exist');
    expect(result).toHaveLength(0);
  });
});
