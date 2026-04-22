/**
 * Integration tests — /api/v1/events/:slug and /api/v1/track.
 *
 * @db — requires the test database. Covers TDD-0005 §3 surface end-to-end.
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

const eventDetailRoute = await import('@/app/api/v1/events/[slug]/route');
const eventSaveRoute = await import('@/app/api/v1/events/[slug]/save/route');
const trackRoute = await import('@/app/api/v1/track/route');

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

async function seedUser(email = 'test@example.com') {
  return testDb.user.create({ data: { email, role: 'USER' } });
}

async function seedEvent(
  cityId: string,
  slug: string,
  startsAt = new Date(Date.now() + 86400_000),
) {
  return testDb.event.create({
    data: {
      title: 'Test Event',
      slug,
      cityId,
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

// ─── GET /api/v1/events/:slug ─────────────────────────────────────────────

describe('GET /api/v1/events/:slug', () => {
  it('returns 404 for unknown slug', async () => {
    const req = makeReq('http://localhost/api/v1/events/no-such-event');
    const res = await eventDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'no-such-event' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns event detail for known slug', async () => {
    const city = await seedCity();
    const event = await seedEvent(city.id, 'test-event-detail');

    const req = makeReq('http://localhost/api/v1/events/test-event-detail');
    const res = await eventDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'test-event-detail' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(event.id);
    expect(body.slug).toBe('test-event-detail');
    expect(body.title).toBe('Test Event');
    expect(body.relatedEvents).toEqual([]);
    expect(body.trustSignals).toEqual([]);
  });

  it('includes savedByUser=false when authed but not saved', async () => {
    const city = await seedCity();
    await seedEvent(city.id, 'evt-auth-check');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    const req = makeReq('http://localhost/api/v1/events/evt-auth-check', { headers });
    const res = await eventDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'evt-auth-check' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedByUser).toBe(false);
  });

  it('includes savedByUser=true when event is saved', async () => {
    const city = await seedCity();
    const event = await seedEvent(city.id, 'evt-saved-check');
    const user = await seedUser();
    // Pre-save the event
    await testDb.savedEvent.create({ data: { userId: user.id, eventId: event.id } });

    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/events/evt-saved-check', { headers });
    const res = await eventDetailRoute.GET(req, {
      params: Promise.resolve({ slug: 'evt-saved-check' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedByUser).toBe(true);
  });

  it('omits savedByUser when no auth', async () => {
    const city = await seedCity();
    await seedEvent(city.id, 'evt-anon');
    const req = makeReq('http://localhost/api/v1/events/evt-anon');
    const res = await eventDetailRoute.GET(req, { params: Promise.resolve({ slug: 'evt-anon' }) });
    const body = await res.json();
    expect(body.savedByUser).toBeUndefined();
  });
});

// ─── POST /api/v1/events/:slug/save ──────────────────────────────────────

describe('POST /api/v1/events/:slug/save', () => {
  it('returns 401 without token', async () => {
    const req = makeReq('http://localhost/api/v1/events/evt-x/save', { method: 'POST' });
    const res = await eventSaveRoute.POST(req, { params: Promise.resolve({ slug: 'evt-x' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown slug', async () => {
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/events/not-here/save', {
      method: 'POST',
      headers,
    });
    const res = await eventSaveRoute.POST(req, { params: Promise.resolve({ slug: 'not-here' }) });
    expect(res.status).toBe(404);
  });

  it('saves an event and returns { saved: true }', async () => {
    const city = await seedCity();
    await seedEvent(city.id, 'evt-to-save');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    const req = makeReq('http://localhost/api/v1/events/evt-to-save/save', {
      method: 'POST',
      headers,
    });
    const res = await eventSaveRoute.POST(req, {
      params: Promise.resolve({ slug: 'evt-to-save' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.saved).toBe(true);
  });

  it('is idempotent (double-save)', async () => {
    const city = await seedCity();
    await seedEvent(city.id, 'evt-idem');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    for (let i = 0; i < 2; i++) {
      const req = makeReq('http://localhost/api/v1/events/evt-idem/save', {
        method: 'POST',
        headers,
      });
      const res = await eventSaveRoute.POST(req, { params: Promise.resolve({ slug: 'evt-idem' }) });
      expect(res.status).toBe(200);
    }
  });
});

// ─── DELETE /api/v1/events/:slug/save ────────────────────────────────────

describe('DELETE /api/v1/events/:slug/save', () => {
  it('unsaves an event and returns { saved: false }', async () => {
    const city = await seedCity();
    const event = await seedEvent(city.id, 'evt-unsave');
    const user = await seedUser();
    await testDb.savedEvent.create({ data: { userId: user.id, eventId: event.id } });

    const headers = await bearerHeaders({ userId: user.id, email: user.email! });
    const req = makeReq('http://localhost/api/v1/events/evt-unsave/save', {
      method: 'DELETE',
      headers,
    });
    const res = await eventSaveRoute.DELETE(req, {
      params: Promise.resolve({ slug: 'evt-unsave' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.saved).toBe(false);
  });

  it('is idempotent (double-unsave)', async () => {
    const city = await seedCity();
    await seedEvent(city.id, 'evt-idem-del');
    const user = await seedUser();
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    for (let i = 0; i < 2; i++) {
      const req = makeReq('http://localhost/api/v1/events/evt-idem-del/save', {
        method: 'DELETE',
        headers,
      });
      const res = await eventSaveRoute.DELETE(req, {
        params: Promise.resolve({ slug: 'evt-idem-del' }),
      });
      expect(res.status).toBe(200);
    }
  });
});

// ─── POST /api/v1/track ───────────────────────────────────────────────────

describe('POST /api/v1/track', () => {
  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    }) as unknown as import('next/server').NextRequest;
    const res = await trackRoute.POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts a valid tracking event and returns { ok: true }', async () => {
    const city = await seedCity('stgt-track');
    const event = await seedEvent(city.id, 'evt-tracked');

    const req = makeReq('http://localhost/api/v1/track', {
      method: 'POST',
      body: {
        event: 'event.detail.viewed',
        entityType: 'EVENT',
        entityId: event.id,
        citySlug: 'stgt-track',
      },
    });
    const res = await trackRoute.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify DB row was created
    const rows = await testDb.userInteraction.findMany({ where: { entityId: event.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].interactionType).toBe('VIEW');
    expect(rows[0].userId).toBeNull();
  });

  it('records userId when authed', async () => {
    const city = await seedCity('stgt-track-auth');
    const event = await seedEvent(city.id, 'evt-tracked-auth');
    const user = await seedUser('track-user@example.com');
    const headers = await bearerHeaders({ userId: user.id, email: user.email! });

    const req = makeReq('http://localhost/api/v1/track', {
      method: 'POST',
      body: { event: 'event.detail.viewed', entityType: 'EVENT', entityId: event.id },
      headers,
    });
    const res = await trackRoute.POST(req);
    expect(res.status).toBe(200);

    const rows = await testDb.userInteraction.findMany({ where: { entityId: event.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(user.id);
  });

  it('accepts track event with no entity (pure ping)', async () => {
    const req = makeReq('http://localhost/api/v1/track', {
      method: 'POST',
      body: { event: 'discover.feed.viewed' },
    });
    const res = await trackRoute.POST(req);
    expect(res.status).toBe(200);
  });
});
