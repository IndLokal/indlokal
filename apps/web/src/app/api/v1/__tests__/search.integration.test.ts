/**
 * Integration tests for TDD-0007 search API endpoints.
 *
 * Covers:
 *   GET /api/v1/search         — combined search
 *   GET /api/v1/search/suggest — autocomplete suggestions
 *   GET /api/v1/search/trending — trending keywords
 *
 * @db — requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
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

import { GET as searchGET } from '@/app/api/v1/search/route';
import { GET as suggestGET } from '@/app/api/v1/search/suggest/route';
import { GET as trendingGET } from '@/app/api/v1/search/trending/route';

function makeReq(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ─── Setup ─────────────────────────────────────────────────────────────────

let citySlug: string;
let cityId: string;

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'search-city', name: 'SearchCity' });
  citySlug = city.slug;
  cityId = city.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ─── GET /api/v1/search ─────────────────────────────────────────────────────

describe('GET /api/v1/search', () => {
  it('returns 400 when q is missing', async () => {
    const res = await searchGET(makeReq('/api/v1/search', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when q is empty', async () => {
    const res = await searchGET(makeReq('/api/v1/search', { q: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns empty results when no matches', async () => {
    const res = await searchGET(makeReq('/api/v1/search', { q: 'xyznoexist', citySlug }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeUndefined();
  });

  it('returns matching communities', async () => {
    await createCommunity(testDb, { cityId, name: 'Yoga Stuttgart', slug: 'yoga-stuttgart' });
    const res = await searchGET(
      makeReq('/api/v1/search', { q: 'Yoga', citySlug, type: 'COMMUNITY' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const communities = body.items.filter((i: { type: string }) => i.type === 'COMMUNITY');
    expect(communities.length).toBeGreaterThanOrEqual(1);
    expect(communities[0].item.name).toBe('Yoga Stuttgart');
  });

  it('returns matching events', async () => {
    const community = await createCommunity(testDb, { cityId, slug: 'c1' });
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await createEvent(testDb, {
      cityId,
      communityId: community.id,
      title: 'Diwali Night Stuttgart',
      slug: 'diwali-night',
      startsAt: future,
    });
    const res = await searchGET(
      makeReq('/api/v1/search', { q: 'Diwali', citySlug, type: 'EVENT' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const events = body.items.filter((i: { type: string }) => i.type === 'EVENT');
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].item.title).toBe('Diwali Night Stuttgart');
  });

  it('returns mixed results for type=ALL', async () => {
    await createCommunity(testDb, { cityId, name: 'Tabla Stuttgart', slug: 'tabla' });
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const community = await createCommunity(testDb, { cityId, slug: 'tabla-ev' });
    await createEvent(testDb, {
      cityId,
      communityId: community.id,
      title: 'Tabla Workshop',
      slug: 'tabla-workshop',
      startsAt: future,
    });
    const res = await searchGET(makeReq('/api/v1/search', { q: 'Tabla', citySlug, type: 'ALL' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const types = body.items.map((i: { type: string }) => i.type);
    expect(types).toContain('COMMUNITY');
    expect(types).toContain('EVENT');
  });

  it('returns nextCursor when more results exist', async () => {
    // Create 5 communities all matching
    for (let i = 0; i < 5; i++) {
      await createCommunity(testDb, {
        cityId,
        name: `Cricket Club ${i}`,
        slug: `cricket-${i}`,
        activityScore: i,
      });
    }
    const res = await searchGET(
      makeReq('/api/v1/search', { q: 'Cricket', citySlug, type: 'COMMUNITY', limit: '2' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeDefined();
  });

  it('cursor advances results', async () => {
    for (let i = 0; i < 5; i++) {
      await createCommunity(testDb, {
        cityId,
        name: `Bhangra Group ${i}`,
        slug: `bhangra-${i}`,
        activityScore: i,
      });
    }
    const first = await (
      await searchGET(
        makeReq('/api/v1/search', { q: 'Bhangra', citySlug, type: 'COMMUNITY', limit: '2' }),
      )
    ).json();
    expect(first.nextCursor).toBeDefined();

    const second = await (
      await searchGET(
        makeReq('/api/v1/search', {
          q: 'Bhangra',
          citySlug,
          type: 'COMMUNITY',
          limit: '2',
          cursor: first.nextCursor,
        }),
      )
    ).json();

    const firstNames = first.items.map((i: { item: { name: string } }) => i.item.name);
    const secondNames = second.items.map((i: { item: { name: string } }) => i.item.name);
    const overlap = firstNames.filter((n: string) => secondNames.includes(n));
    expect(overlap).toHaveLength(0);
  });
});

// ─── GET /api/v1/search/suggest ─────────────────────────────────────────────

describe('GET /api/v1/search/suggest', () => {
  it('returns 400 when q is missing', async () => {
    const res = await suggestGET(makeReq('/api/v1/search/suggest', {}));
    expect(res.status).toBe(400);
  });

  it('returns empty array when no matches', async () => {
    const res = await suggestGET(makeReq('/api/v1/search/suggest', { q: 'zzznomatch', citySlug }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('suggests community names matching prefix', async () => {
    await createCommunity(testDb, { cityId, name: 'Bollywood Dance', slug: 'bollywood' });
    const res = await suggestGET(makeReq('/api/v1/search/suggest', { q: 'Bolly', citySlug }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const texts = body.map((s: { text: string }) => s.text);
    expect(texts).toContain('Bollywood Dance');
  });

  it('suggests event titles matching prefix', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const community = await createCommunity(testDb, { cityId, slug: 'ev-com' });
    await createEvent(testDb, {
      cityId,
      communityId: community.id,
      title: 'Navratri Festival',
      slug: 'navratri',
      startsAt: future,
    });
    const res = await suggestGET(makeReq('/api/v1/search/suggest', { q: 'Navratri', citySlug }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const texts = body.map((s: { text: string }) => s.text);
    expect(texts).toContain('Navratri Festival');
  });

  it('suggests approved keywords', async () => {
    await testDb.keywordSuggestion.create({
      data: {
        keyword: 'Garba',
        normalizedKeyword: 'garba',
        status: 'APPROVED',
        confidence: 0.9,
      },
    });
    const res = await suggestGET(makeReq('/api/v1/search/suggest', { q: 'Gar' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const texts = body.map((s: { text: string }) => s.text);
    expect(texts).toContain('Garba');
  });

  it('does not suggest rejected keywords', async () => {
    await testDb.keywordSuggestion.create({
      data: {
        keyword: 'Spammer',
        normalizedKeyword: 'spammer',
        status: 'REJECTED',
        confidence: 0.1,
      },
    });
    const res = await suggestGET(makeReq('/api/v1/search/suggest', { q: 'Spam' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const texts = body.map((s: { text: string }) => s.text);
    expect(texts).not.toContain('Spammer');
  });
});

// ─── GET /api/v1/search/trending ────────────────────────────────────────────

describe('GET /api/v1/search/trending', () => {
  it('returns empty array when no data', async () => {
    const res = await trendingGET(makeReq('/api/v1/search/trending', {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns approved keywords ordered by confidence', async () => {
    await testDb.keywordSuggestion.createMany({
      data: [
        { keyword: 'Cricket', normalizedKeyword: 'cricket', status: 'APPROVED', confidence: 0.8 },
        { keyword: 'Kabaddi', normalizedKeyword: 'kabaddi', status: 'APPROVED', confidence: 0.5 },
        {
          keyword: 'Badminton',
          normalizedKeyword: 'badminton',
          status: 'APPROVED',
          confidence: 0.95,
        },
      ],
    });
    const res = await trendingGET(makeReq('/api/v1/search/trending', {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toBe('Badminton');
    expect(body).toContain('Cricket');
    expect(body).toContain('Kabaddi');
  });

  it('falls back to trending community names when no keywords', async () => {
    await createCommunity(testDb, {
      cityId,
      name: 'Trending Club',
      slug: 'trending-club',
      isTrending: true,
      activityScore: 100,
    });
    const res = await trendingGET(makeReq('/api/v1/search/trending', { citySlug }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toContain('Trending Club');
  });

  it('does not include rejected keywords in trending', async () => {
    await testDb.keywordSuggestion.create({
      data: {
        keyword: 'BadKeyword',
        normalizedKeyword: 'badkeyword',
        status: 'REJECTED',
        confidence: 0.9,
      },
    });
    const res = await trendingGET(makeReq('/api/v1/search/trending', {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toContain('BadKeyword');
  });
});
