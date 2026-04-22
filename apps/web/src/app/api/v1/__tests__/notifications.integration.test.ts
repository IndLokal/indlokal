/**
 * Integration tests — /api/v1/devices and /api/v1/notifications/*.
 *
 * @db — requires the test database. Covers TDD-0002 §3 surface end-to-end.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

const devicesRoute = await import('@/app/api/v1/devices/route');
const deviceItemRoute = await import('@/app/api/v1/devices/[installationId]/route');
const prefsRoute = await import('@/app/api/v1/notifications/preferences/route');
const inboxRoute = await import('@/app/api/v1/notifications/inbox/route');
const inboxReadRoute = await import('@/app/api/v1/notifications/inbox/read/route');

async function createUser(email: string) {
  return testDb.user.create({ data: { email, role: 'USER' } });
}

function jsonRequest(url: string, method: string, headers: Record<string, string>, body?: unknown) {
  return new Request(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => cleanDb());
afterAll(async () => {
  await testDb.$disconnect();
});

describe('POST /api/v1/devices', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await devicesRoute.POST(
      new Request('http://l/api/v1/devices', { method: 'POST' }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('upserts a device on first call and refreshes on the second', async () => {
    const user = await createUser('a@example.test');
    const headers = await bearerHeaders({ userId: user.id });

    const res1 = await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', headers, {
        installationId: 'inst-1',
        platform: 'IOS',
        expoPushToken: 'ExponentPushToken[abc]',
        locale: 'de',
        timezone: 'Europe/Berlin',
        appVersion: '1.0.0',
      }) as never,
    );
    expect(res1.status).toBe(200);
    const created = await res1.json();
    expect(created.installationId).toBe('inst-1');
    expect(created.expoPushToken).toBe('ExponentPushToken[abc]');

    // Second call rotates token only — must NOT create a new row.
    const res2 = await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', headers, {
        installationId: 'inst-1',
        platform: 'IOS',
        expoPushToken: 'ExponentPushToken[xyz]',
      }) as never,
    );
    expect(res2.status).toBe(200);
    const refreshed = await res2.json();
    expect(refreshed.id).toBe(created.id);
    expect(refreshed.expoPushToken).toBe('ExponentPushToken[xyz]');

    const count = await testDb.device.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  it('400 on invalid body', async () => {
    const user = await createUser('b@example.test');
    const headers = await bearerHeaders({ userId: user.id });
    const res = await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', headers, {
        installationId: '',
        platform: 'WINDOWS',
      }) as never,
    );
    expect(res.status).toBe(400);
  });
});

describe('PATCH/DELETE /api/v1/devices/:installationId', () => {
  it('PATCH updates only the supplied fields and bumps lastSeenAt', async () => {
    const user = await createUser('c@example.test');
    const headers = await bearerHeaders({ userId: user.id });
    await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', headers, {
        installationId: 'inst-2',
        platform: 'ANDROID',
        locale: 'en',
      }) as never,
    );

    const res = await deviceItemRoute.PATCH(
      jsonRequest('http://l/api/v1/devices/inst-2', 'PATCH', headers, {
        locale: 'de',
        expoPushToken: 'token-2',
      }) as never,
      { params: Promise.resolve({ installationId: 'inst-2' }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locale).toBe('de');
    expect(json.expoPushToken).toBe('token-2');
    expect(json.platform).toBe('ANDROID');
  });

  it('PATCH 404 for an unknown device', async () => {
    const user = await createUser('d@example.test');
    const headers = await bearerHeaders({ userId: user.id });
    const res = await deviceItemRoute.PATCH(
      jsonRequest('http://l/api/v1/devices/missing', 'PATCH', headers, { locale: 'de' }) as never,
      { params: Promise.resolve({ installationId: 'missing' }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE is idempotent and scoped to the calling user', async () => {
    const user = await createUser('e@example.test');
    const other = await createUser('f@example.test');
    const headers = await bearerHeaders({ userId: user.id });
    const otherHeaders = await bearerHeaders({ userId: other.id });

    await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', headers, {
        installationId: 'inst-3',
        platform: 'WEB',
      }) as never,
    );
    // Other user has the same installationId — must survive our DELETE.
    await devicesRoute.POST(
      jsonRequest('http://l/api/v1/devices', 'POST', otherHeaders, {
        installationId: 'inst-3',
        platform: 'WEB',
      }) as never,
    );

    const res = await deviceItemRoute.DELETE(
      jsonRequest('http://l/api/v1/devices/inst-3', 'DELETE', headers) as never,
      { params: Promise.resolve({ installationId: 'inst-3' }) },
    );
    expect(res.status).toBe(200);

    // Idempotent — second call also 200.
    const res2 = await deviceItemRoute.DELETE(
      jsonRequest('http://l/api/v1/devices/inst-3', 'DELETE', headers) as never,
      { params: Promise.resolve({ installationId: 'inst-3' }) },
    );
    expect(res2.status).toBe(200);

    expect(await testDb.device.count({ where: { userId: user.id } })).toBe(0);
    expect(await testDb.device.count({ where: { userId: other.id } })).toBe(1);
  });
});

describe('GET/PUT /api/v1/notifications/preferences', () => {
  it('GET returns the full topic × channel matrix with defaults', async () => {
    const user = await createUser('g@example.test');
    const headers = await bearerHeaders({ userId: user.id });

    const res = await prefsRoute.GET(
      jsonRequest('http://l/api/v1/notifications/preferences', 'GET', headers) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preferences).toHaveLength(8 * 3);
    expect(json.preferences.every((p: { enabled: boolean }) => p.enabled)).toBe(true);
    expect(json.quietHours).toEqual({
      startMin: 22 * 60,
      endMin: 8 * 60,
      timezone: 'Europe/Berlin',
    });
  });

  it('PUT persists preference changes and quiet-hours patch', async () => {
    const user = await createUser('h@example.test');
    const headers = await bearerHeaders({ userId: user.id });

    const res = await prefsRoute.PUT(
      jsonRequest('http://l/api/v1/notifications/preferences', 'PUT', headers, {
        preferences: [
          { topic: 'WEEKLY_DIGEST', channel: 'EMAIL', enabled: false },
          { topic: 'CITY_NEW_EVENT', channel: 'PUSH', enabled: false },
        ],
        quietHours: { startMin: 23 * 60, timezone: 'Europe/Stockholm' },
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const digestEmail = json.preferences.find(
      (p: { topic: string; channel: string }) =>
        p.topic === 'WEEKLY_DIGEST' && p.channel === 'EMAIL',
    );
    expect(digestEmail.enabled).toBe(false);
    expect(json.quietHours.startMin).toBe(23 * 60);
    expect(json.quietHours.endMin).toBe(8 * 60); // existing default preserved
    expect(json.quietHours.timezone).toBe('Europe/Stockholm');

    // Confirm rows persisted.
    const stored = await testDb.notificationPreference.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(2);
  });
});

describe('Inbox', () => {
  it('GET paginates newest-first and POST /read marks scoped items', async () => {
    const user = await createUser('i@example.test');
    const other = await createUser('j@example.test');
    const headers = await bearerHeaders({ userId: user.id });

    // Seed 25 items for `user` and 1 item for `other`.
    for (let i = 0; i < 25; i++) {
      await testDb.inboxItem.create({
        data: {
          userId: user.id,
          topic: 'CITY_NEW_EVENT',
          title: `t${i}`,
          body: `b${i}`,
          createdAt: new Date(Date.now() - (25 - i) * 60_000),
        },
      });
    }
    const otherItem = await testDb.inboxItem.create({
      data: { userId: other.id, topic: 'WEEKLY_DIGEST', title: 'other', body: '' },
    });

    const page1Res = await inboxRoute.GET(
      jsonRequest('http://l/api/v1/notifications/inbox?limit=10', 'GET', headers) as never,
    );
    const page1 = await page1Res.json();
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0].title).toBe('t24');
    expect(page1.nextCursor).toBeDefined();

    const page2Res = await inboxRoute.GET(
      jsonRequest(
        `http://l/api/v1/notifications/inbox?limit=10&cursor=${page1.nextCursor}`,
        'GET',
        headers,
      ) as never,
    );
    const page2 = await page2Res.json();
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].title).toBe('t14');

    // POST /read with one of our ids and the foreign id — only ours should flip.
    const ours = page1.items.slice(0, 3).map((i: { id: string }) => i.id);
    const readRes = await inboxReadRoute.POST(
      jsonRequest('http://l/api/v1/notifications/inbox/read', 'POST', headers, {
        ids: [...ours, otherItem.id],
      }) as never,
    );
    expect(readRes.status).toBe(200);

    const readCount = await testDb.inboxItem.count({
      where: { userId: user.id, readAt: { not: null } },
    });
    expect(readCount).toBe(3);
    const stillUnread = await testDb.inboxItem.findUnique({ where: { id: otherItem.id } });
    expect(stillUnread!.readAt).toBeNull();
  });
});
