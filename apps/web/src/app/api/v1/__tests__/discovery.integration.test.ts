/**
 * Integration tests - /api/v1/cities and /api/v1/discovery/*.
 *
 * @db - requires the test database. Covers TDD-0003 §3 surface end-to-end.
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
  options?: { cost?: string | null; isOnline?: boolean },
) {
  return testDb.event.create({
    data: {
      title,
      slug: title.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      cityId,
      communityId,
      status: 'UPCOMING',
      startsAt,
      ...(options?.cost !== undefined ? { cost: options.cost } : {}),
      ...(options?.isOnline !== undefined ? { isOnline: options.isOnline } : {}),
    },
  });
}

async function seedCategory(slug: string, name: string) {
  return testDb.category.create({
    data: {
      slug,
      name,
      type: 'CATEGORY',
      sortOrder: 0,
    },
  });
}

beforeEach(() => cleanDb());
afterAll(() => testDb.$disconnect());

// ─── GET /api/v1/cities ───────────────────────────────────────────────────

describe('GET /api/v1/cities', () => {
  it('returns an empty array when no active cities exist', async () => {
    const res = await citiesRoute.GET(new Request('http://localhost/api/v1/cities') as never);
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

    const res = await citiesRoute.GET(new Request('http://localhost/api/v1/cities') as never);
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

  it('supports categorySlugs OR filtering', async () => {
    const city = await seedCity();
    const professional = await seedCategory('professional', 'Professional');
    const networking = await seedCategory('networking-social', 'Networking & Social');
    const cultural = await seedCategory('cultural', 'Cultural');

    const professionalEvent = await seedEvent(
      city.id,
      null,
      'Professional Meetup',
      new Date(Date.now() + 3_600_000),
    );
    const networkingEvent = await seedEvent(
      city.id,
      null,
      'Founder Networking Night',
      new Date(Date.now() + 7_200_000),
    );
    const culturalEvent = await seedEvent(
      city.id,
      null,
      'Cultural Festival',
      new Date(Date.now() + 10_800_000),
    );

    await testDb.eventCategory.createMany({
      data: [
        { eventId: professionalEvent.id, categoryId: professional.id },
        { eventId: networkingEvent.id, categoryId: networking.id },
        { eventId: culturalEvent.id, categoryId: cultural.id },
      ],
    });

    const res = await eventsRoute.GET(
      new Request(
        'http://l/api/v1/discovery/stuttgart/events?categorySlugs=professional&categorySlugs=networking-social',
      ) as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    const titles = json.items.map((item: { title: string }) => item.title);
    expect(titles).toContain('Professional Meetup');
    expect(titles).toContain('Founder Networking Night');
    expect(titles).not.toContain('Cultural Festival');
  });

  it('normalizes comma-separated and mixed-case categorySlugs', async () => {
    const city = await seedCity();
    const professional = await seedCategory('professional', 'Professional');
    const networking = await seedCategory('networking-social', 'Networking & Social');
    const sports = await seedCategory('sports', 'Sports');

    const professionalEvent = await seedEvent(
      city.id,
      null,
      'Professional Growth Session',
      new Date(Date.now() + 3_600_000),
    );
    const networkingEvent = await seedEvent(
      city.id,
      null,
      'Networking Mixer',
      new Date(Date.now() + 7_200_000),
    );
    const sportsEvent = await seedEvent(
      city.id,
      null,
      'Cricket Social',
      new Date(Date.now() + 10_800_000),
    );

    await testDb.eventCategory.createMany({
      data: [
        { eventId: professionalEvent.id, categoryId: professional.id },
        { eventId: networkingEvent.id, categoryId: networking.id },
        { eventId: sportsEvent.id, categoryId: sports.id },
      ],
    });

    const res = await eventsRoute.GET(
      new Request(
        'http://l/api/v1/discovery/stuttgart/events?categorySlugs= Professional,NETWORKING-social,professional ',
      ) as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    const titles = json.items.map((item: { title: string }) => item.title);
    expect(titles).toContain('Professional Growth Session');
    expect(titles).toContain('Networking Mixer');
    expect(titles).not.toContain('Cricket Social');
  });

  it('prefers categorySlugs when both categorySlug and categorySlugs are provided', async () => {
    const city = await seedCity();
    const professional = await seedCategory('professional', 'Professional');
    const networking = await seedCategory('networking-social', 'Networking & Social');

    const professionalEvent = await seedEvent(
      city.id,
      null,
      'Professional Meetup Legacy',
      new Date(Date.now() + 3_600_000),
    );
    const networkingEvent = await seedEvent(
      city.id,
      null,
      'Networking Meetup Legacy',
      new Date(Date.now() + 7_200_000),
    );

    await testDb.eventCategory.createMany({
      data: [
        { eventId: professionalEvent.id, categoryId: professional.id },
        { eventId: networkingEvent.id, categoryId: networking.id },
      ],
    });

    const res = await eventsRoute.GET(
      new Request(
        'http://l/api/v1/discovery/stuttgart/events?categorySlug=professional&categorySlugs=networking-social',
      ) as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    const titles = json.items.map((item: { title: string }) => item.title);
    expect(titles).toContain('Networking Meetup Legacy');
    expect(titles).not.toContain('Professional Meetup Legacy');
  });

  it('supports cost filtering for free and paid', async () => {
    const city = await seedCity();
    await seedEvent(city.id, null, 'Free Meetup', new Date(Date.now() + 3_600_000), {
      cost: 'free',
    });
    await seedEvent(city.id, null, 'Paid Workshop', new Date(Date.now() + 7_200_000), {
      cost: '19',
    });
    await seedEvent(city.id, null, 'Cost Not Set', new Date(Date.now() + 10_800_000), {
      cost: null,
    });

    const freeRes = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?cost=free') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(freeRes.status).toBe(200);
    const freeTitles = (await freeRes.json()).items.map((item: { title: string }) => item.title);
    expect(freeTitles).toContain('Free Meetup');
    expect(freeTitles).not.toContain('Paid Workshop');

    const paidRes = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?cost=paid') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(paidRes.status).toBe(200);
    const paidTitles = (await paidRes.json()).items.map((item: { title: string }) => item.title);
    expect(paidTitles).toContain('Paid Workshop');
    expect(paidTitles).not.toContain('Free Meetup');
    expect(paidTitles).not.toContain('Cost Not Set');
  });

  it('supports type filtering for online and in-person', async () => {
    const city = await seedCity();
    await seedEvent(city.id, null, 'Online Webinar', new Date(Date.now() + 3_600_000), {
      isOnline: true,
    });
    await seedEvent(city.id, null, 'In Person Meetup', new Date(Date.now() + 7_200_000), {
      isOnline: false,
    });

    const onlineRes = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?type=online') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(onlineRes.status).toBe(200);
    const onlineTitles = (await onlineRes.json()).items.map(
      (item: { title: string }) => item.title,
    );
    expect(onlineTitles).toContain('Online Webinar');
    expect(onlineTitles).not.toContain('In Person Meetup');

    const inPersonRes = await eventsRoute.GET(
      new Request('http://l/api/v1/discovery/stuttgart/events?type=in-person') as never,
      { params: Promise.resolve({ citySlug: 'stuttgart' }) },
    );
    expect(inPersonRes.status).toBe(200);
    const inPersonTitles = (await inPersonRes.json()).items.map(
      (item: { title: string }) => item.title,
    );
    expect(inPersonTitles).toContain('In Person Meetup');
    expect(inPersonTitles).not.toContain('Online Webinar');
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
