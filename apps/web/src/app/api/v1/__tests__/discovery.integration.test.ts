/**
 * Integration tests — /api/v1/cities and /api/v1/discovery/*.
 *
 * @db — requires the test database. Covers TDD-0003 §3 surface end-to-end.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb: tDb } = await import('@/test/db-helpers');

  // resolveCityIds closes over the original db in its module scope;
  // supply a version that queries testDb instead.
  async function resolveCityIds(citySlug: string): Promise<string[]> {
    const city = await tDb.city.findUnique({
      where: { slug: citySlug },
      select: { id: true, satelliteCities: { select: { id: true } } },
    });
    if (!city) return [];
    return [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
  }

  return { ...mod, db: tDb, resolveCityIds };
});

const citiesRoute = await import('@/app/api/v1/cities/route');
const citySlugRoute = await import('@/app/api/v1/cities/[slug]/route');
const eventsRoute = await import('@/app/api/v1/discovery/[citySlug]/events/route');
const communitiesRoute = await import('@/app/api/v1/discovery/[citySlug]/communities/route');
const trendingRoute = await import('@/app/api/v1/discovery/[citySlug]/trending/route');

// ─── seed helpers ──────────────────────────────────────────────────────────

async function seedCity(slug = 'stuttgart') {
  return testDb.city.create({
    data: {
      name: 'Stuttgart',
      slug,
      state: 'Baden-Württemberg',
      country: 'Germany',
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
    },
  });
}

async function seedCommunity(cityId: string, name: string, activityScore = 0, isTrending = false) {
  return testDb.community.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      cityId,
      status: 'ACTIVE',
      activityScore,
      trustScore: 0,
      completenessScore: 0,
      isTrending,
    },
  });
}

async function seedEvent(
  cityId: string,
  communityId: string | null,
  title: string,
  startsAt: Date,
) {
  return testDb.event.create({
    data: {
      title,
      slug: title.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      cityId,
      communityId,
      status: 'UPCOMING',
      startsAt,
    },
  });
}

beforeEach(() => cleanDb());
afterAll(() => testDb.$disconnect());

// ─── GET /api/v1/cities ───────────────────────────────────────────────────

describe('GET /api/v1/cities', () => {
  it('returns an empty array when no active cities exist', async () => {
    const res = await citiesRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns only active cities', async () => {
    await seedCity('stuttgart');
    await testDb.city.create({
      data: {
        name: 'Berlin',
        slug: 'berlin',
        state: 'Berlin',
        isActive: false,
        timezone: 'Europe/Berlin',
      },
    });

    const res = await citiesRoute.GET();
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].slug).toBe('stuttgart');
  });
});

// ─── GET /api/v1/cities/:slug ──────────────────────────────────────────────

describe('GET /api/v1/cities/:slug', () => {
  it('404 for unknown slug', async () => {
    const res = await citySlugRoute.GET(new Request('http://l/api/v1/cities/unknown') as never, {
      params: Promise.resolve({ slug: 'unknown' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns city detail with counts and empty category list', async () => {
    const city = await seedCity();

    const res = await citySlugRoute.GET(new Request('http://l/api/v1/cities/stuttgart') as never, {
      params: Promise.resolve({ slug: 'stuttgart' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(city.id);
    expect(json.slug).toBe('stuttgart');
    expect(json.counts).toEqual({ communities: 0, upcomingEvents: 0, categories: 0 });
    expect(json.categories).toEqual([]);
  });

  it('includes community and event counts', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'IndStuttgart A', 10);
    await seedCommunity(city.id, 'IndStuttgart B', 5);
    await seedEvent(city.id, null, 'Diwali Night', new Date(Date.now() + 86_400_000));

    const res = await citySlugRoute.GET(new Request('http://l/api/v1/cities/stuttgart') as never, {
      params: Promise.resolve({ slug: 'stuttgart' }),
    });
    const json = await res.json();
    expect(json.counts.communities).toBe(2);
    expect(json.counts.upcomingEvents).toBe(1);
  });
});

// ─── GET /api/v1/discovery/:citySlug/events ────────────────────────────────

describe('GET /api/v1/discovery/:citySlug/events', () => {
  it('returns empty page for city with no events', async () => {
    await seedCity();
    const res = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.nextCursor).toBeUndefined();
  });

  it('paginates upcoming events cursor-style', async () => {
    const city = await seedCity();
    // Seed 5 upcoming events
    for (let i = 0; i < 5; i++) {
      await seedEvent(city.id, null, `Event ${i}`, new Date(Date.now() + (i + 1) * 3_600_000));
    }

    const res1 = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?limit=3') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    const page1 = await res1.json();
    expect(page1.items).toHaveLength(3);
    expect(page1.items[0].title).toBe('Event 0');
    expect(page1.nextCursor).toBeDefined();

    const res2 = await eventsRoute.GET(
      new Request(
        `http://l/api/v1/discovery/stuttgart/events?limit=3&cursor=${page1.nextCursor}`,
      ) as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    const page2 = await res2.json();
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeUndefined();
  });

  it('400 on invalid limit', async () => {
    await seedCity();
    const res = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?limit=9999') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns empty items for an unknown city (not 404)', async () => {
    const res = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/nowhere/events') as never,
      { params: Promise.resolve({ citySlug: 'nowhere' }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });
});

// ─── GET /api/v1/discovery/:citySlug/communities ───────────────────────────

describe('GET /api/v1/discovery/:citySlug/communities', () => {
  it('paginates communities ordered by activityScore desc', async () => {
    const city = await seedCity();
    // Seed 4 communities with varying scores
    await seedCommunity(city.id, 'Alpha', 100);
    await seedCommunity(city.id, 'Beta', 80);
    await seedCommunity(city.id, 'Gamma', 60);
    await seedCommunity(city.id, 'Delta', 40);

    const res1 = await communitiesRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/communities?limit=2') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    const page1 = await res1.json();
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].name).toBe('Alpha');
    expect(page1.nextCursor).toBeDefined();

    const res2 = await communitiesRoute.GET(
      new Request(
        `http://l/api/v1/discovery/stuttgart/communities?limit=2&cursor=${page1.nextCursor}`,
      ) as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    const page2 = await res2.json();
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeUndefined();
  });
});

// ─── GET /api/v1/discovery/:citySlug/trending ──────────────────────────────

describe('GET /api/v1/discovery/:citySlug/trending', () => {
  it('404 for unknown city', async () => {
    const res = await trendingRoute.GET(
      new Request('http://l/api/v1/discovery/nowhere/trending') as never,
      { params: Promise.resolve({ citySlug: 'nowhere' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns only isTrending communities in the response', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'Hot Community', 90, true);
    await seedCommunity(city.id, 'Cold Community', 50, false);
    await seedEvent(city.id, null, 'Big Event', new Date(Date.now() + 3_600_000));

    const res = await trendingRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/trending') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.communities).toHaveLength(1);
    expect(json.communities[0].name).toBe('Hot Community');
    expect(json.events).toHaveLength(1);
    expect(json.events[0].title).toBe('Big Event');
    expect(json.categories).toBeInstanceOf(Array);
  });
});
