/**
 * Integration tests for TDD-0010:
 *   GET  /api/v1/cities/:slug/resources?type
 *   GET  /api/v1/me/saves/events?cursor
 *   GET  /api/v1/me/saves/communities?cursor
 *   POST /api/v1/reports
 *
 * @db — requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';
import { createCity, createCommunity, createEvent } from '@/test/fixtures';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

// Suppress email calls in tests
vi.mock('@/lib/email', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/email')>();
  return {
    ...mod,
    sendReportNotificationEmail: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET as resourcesGET } from '@/app/api/v1/cities/[slug]/resources/route';
import { GET as savedEventsGET } from '@/app/api/v1/me/saves/events/route';
import { GET as savedCommunitiesGET } from '@/app/api/v1/me/saves/communities/route';
import { POST as reportPOST } from '@/app/api/v1/reports/route';

// ─── Setup ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-resources-test-01';

let cityId: string;
let citySlug: string;
let authHeaders: Record<string, string>;

function makeGET(url: string, hdrs: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers: hdrs });
}

function makePOST(path: string, body: unknown, hdrs: Record<string, string>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'resources-city', name: 'ResourcesCity' });
  cityId = city.id;
  citySlug = city.slug;
  authHeaders = await bearerHeaders({ userId: USER_ID });
  // User row is required for FK constraints on saved_events / saved_communities
  await testDb.user.upsert({
    where: { id: USER_ID },
    create: { id: USER_ID, email: `${USER_ID}@test.com` },
    update: {},
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ─── GET /api/v1/cities/:slug/resources ────────────────────────────────────

describe('GET /api/v1/cities/:slug/resources', () => {
  async function makeResourcesRequest(slug: string, typeParam?: string) {
    const url = typeParam
      ? `http://localhost/api/v1/cities/${slug}/resources?type=${typeParam}`
      : `http://localhost/api/v1/cities/${slug}/resources`;
    const req = makeGET(url);
    return resourcesGET(req, { params: Promise.resolve({ slug }) });
  }

  it('returns empty array for city with no resources', async () => {
    const res = await makeResourcesRequest(citySlug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns empty array for unknown city slug (graceful)', async () => {
    const res = await makeResourcesRequest('ghost-city');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns resources for a city', async () => {
    await testDb.resource.create({
      data: {
        title: 'Registration Guide',
        slug: 'registration-guide',
        resourceType: 'CITY_REGISTRATION',
        cityId,
      },
    });
    await testDb.resource.create({
      data: {
        title: 'Driving Licence FAQ',
        slug: 'driving-licence-faq',
        resourceType: 'DRIVING',
        cityId,
      },
    });

    const res = await makeResourcesRequest(citySlug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body.map((r: { resourceType: string }) => r.resourceType)).toContain(
      'CITY_REGISTRATION',
    );
  });

  it('filters by type parameter (enum value)', async () => {
    await testDb.resource.create({
      data: {
        title: 'Registration Guide',
        slug: 'registration-guide-2',
        resourceType: 'CITY_REGISTRATION',
        cityId,
      },
    });
    await testDb.resource.create({
      data: {
        title: 'Driving Licence FAQ',
        slug: 'driving-licence-faq-2',
        resourceType: 'DRIVING',
        cityId,
      },
    });

    const res = await makeResourcesRequest(citySlug, 'CITY_REGISTRATION');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].resourceType).toBe('CITY_REGISTRATION');
  });

  it('filters by type parameter (slug form)', async () => {
    await testDb.resource.create({
      data: {
        title: 'Driving Guide',
        slug: 'driving-guide',
        resourceType: 'DRIVING',
        cityId,
      },
    });

    const res = await makeResourcesRequest(citySlug, 'driving');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].resourceType).toBe('DRIVING');
  });
});

// ─── GET /api/v1/me/saves/events ───────────────────────────────────────────

describe('GET /api/v1/me/saves/events', () => {
  it('returns 401 without token', async () => {
    const res = await savedEventsGET(makeGET('http://localhost/api/v1/me/saves/events'));
    expect(res.status).toBe(401);
  });

  it('returns empty page when no events saved', async () => {
    const res = await savedEventsGET(
      makeGET('http://localhost/api/v1/me/saves/events', authHeaders),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeUndefined();
  });

  it('returns saved events for user', async () => {
    const event = await createEvent(testDb, { cityId });
    await testDb.savedEvent.create({ data: { userId: USER_ID, eventId: event.id } });

    const res = await savedEventsGET(
      makeGET('http://localhost/api/v1/me/saves/events', authHeaders),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(event.id);
    expect(body.items[0].savedAt).toBeDefined();
  });

  it('paginates with cursor', async () => {
    // Create 3 events and save them
    const eventIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const e = await createEvent(testDb, {
        cityId,
        slug: `event-saves-${i}`,
        title: `Event Saves ${i}`,
      });
      eventIds.push(e.id);
      await testDb.savedEvent.create({ data: { userId: USER_ID, eventId: e.id } });
    }

    // First page — limit 2
    const res1 = await savedEventsGET(
      makeGET('http://localhost/api/v1/me/saves/events?limit=2', authHeaders),
    );
    expect(res1.status).toBe(200);
    const page1 = await res1.json();
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    // Second page
    const res2 = await savedEventsGET(
      makeGET(
        `http://localhost/api/v1/me/saves/events?limit=2&cursor=${page1.nextCursor}`,
        authHeaders,
      ),
    );
    expect(res2.status).toBe(200);
    const page2 = await res2.json();
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeUndefined();
  });
});

// ─── GET /api/v1/me/saves/communities ──────────────────────────────────────

describe('GET /api/v1/me/saves/communities', () => {
  it('returns 401 without token', async () => {
    const res = await savedCommunitiesGET(makeGET('http://localhost/api/v1/me/saves/communities'));
    expect(res.status).toBe(401);
  });

  it('returns empty page when no communities saved', async () => {
    const res = await savedCommunitiesGET(
      makeGET('http://localhost/api/v1/me/saves/communities', authHeaders),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeUndefined();
  });

  it('returns saved communities for user', async () => {
    const community = await createCommunity(testDb, {
      cityId,
      name: 'Stuttgart Salsa Club',
      slug: 'stuttgart-salsa-club',
    });
    await testDb.savedCommunity.create({
      data: { userId: USER_ID, communityId: community.id },
    });

    const res = await savedCommunitiesGET(
      makeGET('http://localhost/api/v1/me/saves/communities', authHeaders),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(community.id);
    expect(body.items[0].name).toBe('Stuttgart Salsa Club');
    expect(body.items[0].savedAt).toBeDefined();
  });

  it('does not return other users saved communities', async () => {
    const otherUserId = 'other-user-id';
    await testDb.user.upsert({
      where: { id: otherUserId },
      create: { id: otherUserId, email: `${otherUserId}@test.com` },
      update: {},
    });
    const community = await createCommunity(testDb, {
      cityId,
      name: 'Other User Community',
      slug: 'other-user-community',
    });
    await testDb.savedCommunity.create({
      data: { userId: 'other-user-id', communityId: community.id },
    });

    const res = await savedCommunitiesGET(
      makeGET('http://localhost/api/v1/me/saves/communities', authHeaders),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });
});

// ─── POST /api/v1/reports ──────────────────────────────────────────────────

describe('POST /api/v1/reports', () => {
  it('returns 401 without token', async () => {
    const res = await reportPOST(makePOST('/api/v1/reports', {}, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid reportType', async () => {
    const res = await reportPOST(
      makePOST('/api/v1/reports', { reportType: 'INVALID_TYPE' }, authHeaders),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing reportType', async () => {
    const res = await reportPOST(
      makePOST('/api/v1/reports', { details: 'some info' }, authHeaders),
    );
    expect(res.status).toBe(400);
  });

  it('creates a STALE_INFO report', async () => {
    const community = await createCommunity(testDb, {
      cityId,
      name: 'Stale Community',
      slug: 'stale-community',
    });
    const res = await reportPOST(
      makePOST(
        '/api/v1/reports',
        {
          reportType: 'STALE_INFO',
          communityId: community.id,
          details: 'The phone number is wrong',
          reporterEmail: 'user@example.com',
        },
        authHeaders,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reportType).toBe('STALE_INFO');
    expect(body.status).toBe('PENDING');
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();

    // Verify DB row
    const row = await testDb.contentReport.findUnique({ where: { id: body.id } });
    expect(row?.communityId).toBe(community.id);
    expect(row?.reporterEmail).toBe('user@example.com');
  });

  it('creates a SUGGEST_COMMUNITY report with citySlug', async () => {
    const res = await reportPOST(
      makePOST(
        '/api/v1/reports',
        {
          reportType: 'SUGGEST_COMMUNITY',
          suggestedName: 'Stuttgart Kabaddi League',
          citySlug,
          details: 'I met them at the park',
        },
        authHeaders,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reportType).toBe('SUGGEST_COMMUNITY');

    const row = await testDb.contentReport.findUnique({ where: { id: body.id } });
    expect(row?.suggestedName).toBe('Stuttgart Kabaddi League');
    expect(row?.cityId).toBe(cityId);
  });

  it('returns 404 when communityId does not exist', async () => {
    const res = await reportPOST(
      makePOST(
        '/api/v1/reports',
        {
          reportType: 'STALE_INFO',
          communityId: 'nonexistent-community-id',
        },
        authHeaders,
      ),
    );
    expect(res.status).toBe(404);
  });
});
