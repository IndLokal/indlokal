/**
 * Integration tests — /api/v1/communities/:slug endpoints.
 *
 * @db — requires the test database. Covers TDD-0006 §3 surface end-to-end.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb: tDb } = await import('@/test/db-helpers');

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

const communityDetailRoute = await import('@/app/api/v1/communities/[slug]/route');
const communityFollowRoute = await import('@/app/api/v1/communities/[slug]/follow/route');
const communityEventsRoute = await import('@/app/api/v1/communities/[slug]/events/route');
const communityRelatedRoute = await import('@/app/api/v1/communities/[slug]/related/route');

// ─── Seed helpers ──────────────────────────────────────────────────────────

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

async function seedUser(email = 'community-test@example.com') {
  return testDb.user.create({ data: { email, role: 'USER' } });
}

async function seedCommunity(cityId: string, slug: string) {
  return testDb.community.create({
    data: {
      name: 'Test Community',
      slug,
      cityId,
      status: 'ACTIVE',
      activityScore: 10,
      trustScore: 5,
      completenessScore: 8,
    },
  });
}

async function seedEvent(
  cityId: string,
  communityId: string,
  slug: string,
  startsAt = new Date(Date.now() + 86400_000),
) {
  return testDb.event.create({
    data: {
      title: 'Community Event',
      slug,
      cityId,
      communityId,
      status: 'UPCOMING',
      startsAt,
    },
  });
}

function makeReq(
  url: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const { method = 'GET', body, headers = {} } = opts;
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => cleanDb());
afterAll(() => testDb.$disconnect());

// ─── GET /api/v1/communities/:slug ────────────────────────────────────────

describe('GET /api/v1/communities/:slug', () => {
  it('returns 404 for unknown slug', async () => {
    const req = makeReq('http://localhost/api/v1/communities/no-such-community');
    const res = await communityDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'no-such-community' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns community detail for known slug', async () => {
    const city = await seedCity();
    const community = await seedCommunity(city.id, 'test-community-detail');

    const req = makeReq('http://localhost/api/v1/communities/test-community-detail');
    const res = await communityDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'test-community-detail' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(community.id);
    expect(body.slug).toBe('test-community-detail');
    expect(body.name).toBe('Test Community');
    expect(body.accessChannels).toEqual([]);
    expect(body.trustSignals).toEqual([]);
    expect(body.upcomingEventCount).toBe(0);
  });

  it('includes followedByUser=false when authed but not following', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-auth-check');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    const req = makeReq('http://localhost/api/v1/communities/community-auth-check', { headers });
    const res = await communityDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-auth-check' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followedByUser).toBe(false);
  });

  it('includes followedByUser=true when community is followed', async () => {
    const city = await seedCity();
    const community = await seedCommunity(city.id, 'community-followed-check');
    const user = await seedUser();
    await testDb.savedCommunity.create({ data: { userId: user.id, communityId: community.id } });

    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/communities/community-followed-check', {
      headers,
    });
    const res = await communityDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-followed-check' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followedByUser).toBe(true);
  });

  it('omits followedByUser for anonymous requests', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-anon');
    const req = makeReq('http://localhost/api/v1/communities/community-anon');
    const res = await communityDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-anon' }),
    });
    const body = await res.json();
    expect(body.followedByUser).toBeUndefined();
  });
});

// ─── POST /api/v1/communities/:slug/follow ───────────────────────────────

describe('POST /api/v1/communities/:slug/follow', () => {
  it('returns 401 without token', async () => {
    const req = makeReq('http://localhost/api/v1/communities/c/follow', { method: 'POST' });
    const res = await communityFollowRoute.POST(req, { params: Promise.resolve({ slug: 'c' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown slug', async () => {
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/communities/not-here/follow', {
      method: 'POST',
      headers,
    });
    const res = await communityFollowRoute.POST(req, {
      params: Promise.resolve({ slug: 'not-here' }),
    });
    expect(res.status).toBe(404);
  });

  it('follows a community and returns { followed: true }', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-to-follow');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    const req = makeReq('http://localhost/api/v1/communities/community-to-follow/follow', {
      method: 'POST',
      headers,
    });
    const res = await communityFollowRoute.POST(req, {
      params: Promise.resolve({ slug: 'community-to-follow' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followed).toBe(true);
  });

  it('is idempotent (double-follow)', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-idem-follow');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    for (let i = 0; i < 2; i++) {
      const req = makeReq('http://localhost/api/v1/communities/community-idem-follow/follow', {
        method: 'POST',
        headers,
      });
      const res = await communityFollowRoute.POST(req, {
        params: Promise.resolve({ slug: 'community-idem-follow' }),
      });
      expect(res.status).toBe(200);
    }
  });
});

// ─── DELETE /api/v1/communities/:slug/follow ─────────────────────────────

describe('DELETE /api/v1/communities/:slug/follow', () => {
  it('unfollows a community and returns { followed: false }', async () => {
    const city = await seedCity();
    const community = await seedCommunity(city.id, 'community-to-unfollow');
    const user = await seedUser();
    await testDb.savedCommunity.create({ data: { userId: user.id, communityId: community.id } });

    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/communities/community-to-unfollow/follow', {
      method: 'DELETE',
      headers,
    });
    const res = await communityFollowRoute.DELETE(req, {
      params: Promise.resolve({ slug: 'community-to-unfollow' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followed).toBe(false);
  });

  it('is idempotent (double-unfollow)', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-idem-unfollow');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    for (let i = 0; i < 2; i++) {
      const req = makeReq('http://localhost/api/v1/communities/community-idem-unfollow/follow', {
        method: 'DELETE',
        headers,
      });
      const res = await communityFollowRoute.DELETE(req, {
        params: Promise.resolve({ slug: 'community-idem-unfollow' }),
      });
      expect(res.status).toBe(200);
    }
  });
});

// ─── GET /api/v1/communities/:slug/events ────────────────────────────────

describe('GET /api/v1/communities/:slug/events', () => {
  it('returns 404 for unknown community', async () => {
    const req = makeReq('http://localhost/api/v1/communities/no-such/events');
    const res = await communityEventsRoute.GET(req, {
      params: Promise.resolve({ slug: 'no-such' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns empty events for community with no events', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-no-events');

    const req = makeReq('http://localhost/api/v1/communities/community-no-events/events');
    const res = await communityEventsRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-no-events' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it('returns upcoming events for community', async () => {
    const city = await seedCity();
    const community = await seedCommunity(city.id, 'community-with-events');
    await seedEvent(city.id, community.id, 'event-for-community');

    const req = makeReq('http://localhost/api/v1/communities/community-with-events/events');
    const res = await communityEventsRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-with-events' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe('event-for-community');
  });
});

// ─── GET /api/v1/communities/:slug/related ───────────────────────────────

describe('GET /api/v1/communities/:slug/related', () => {
  it('returns 404 for unknown community', async () => {
    const req = makeReq('http://localhost/api/v1/communities/no-such/related');
    const res = await communityRelatedRoute.GET(req, {
      params: Promise.resolve({ slug: 'no-such' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns empty array when no related communities', async () => {
    const city = await seedCity();
    await seedCommunity(city.id, 'community-no-related');

    const req = makeReq('http://localhost/api/v1/communities/community-no-related/related');
    const res = await communityRelatedRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-no-related' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns related communities via relationship edge', async () => {
    const city = await seedCity();
    const community = await seedCommunity(city.id, 'community-has-related');
    const related = await seedCommunity(city.id, 'community-related-to-it');

    // Create a relationship edge
    await testDb.relationshipEdge.create({
      data: {
        sourceCommunityId: community.id,
        targetCommunityId: related.id,
        relationshipType: 'RELATED_COMMUNITY',
        strength: 1.0,
      },
    });

    const req = makeReq('http://localhost/api/v1/communities/community-has-related/related');
    const res = await communityRelatedRoute.GET(req, {
      params: Promise.resolve({ slug: 'community-has-related' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].slug).toBe('community-related-to-it');
  });
});
