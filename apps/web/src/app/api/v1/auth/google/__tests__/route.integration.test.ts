/**
 * Integration tests — /api/v1/auth/google.
 *
 * @db — requires the test database. Mocks `fetch` to simulate Google's
 * token + userinfo endpoints; we never make a real HTTP call.
 */
import { describe, it, expect, beforeEach, afterAll, beforeAll, afterEach, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

const { POST } = await import('../route');

const ORIGINAL_FETCH = globalThis.fetch;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

beforeEach(() => cleanDb());
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});
afterAll(async () => {
  await testDb.$disconnect();
});

function mockGoogleHappy(profile: { sub: string; email: string; name?: string; picture?: string }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'g-access' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
      return new Response(JSON.stringify(profile), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
}

describe('POST /api/v1/auth/google', () => {
  it('400 on invalid body', async () => {
    const res = await POST(makeRequest({ code: '' }) as never);
    expect(res.status).toBe(400);
  });

  it('creates a new user and returns AuthTokens on first sign-in', async () => {
    mockGoogleHappy({
      sub: 'google-sub-1',
      email: 'New@Example.com',
      name: 'New User',
      picture: 'https://example.com/avatar.png',
    });

    const res = await POST(
      makeRequest({
        code: 'authcode',
        redirectUri: 'https://indlokal.com/auth/callback',
      }) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(json.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(json.user.email).toBe('new@example.com');
    expect(json.user.displayName).toBe('New User');

    const persisted = await testDb.user.findUnique({ where: { email: 'new@example.com' } });
    expect(persisted!.googleId).toBe('google-sub-1');
  });

  it('links googleId to an existing email account', async () => {
    await testDb.user.create({
      data: { email: 'existing@example.com', displayName: 'Existing' },
    });
    mockGoogleHappy({ sub: 'google-sub-2', email: 'Existing@Example.com', name: 'Ignored' });

    const res = await POST(
      makeRequest({ code: 'c', redirectUri: 'https://indlokal.com/cb' }) as never,
    );
    expect(res.status).toBe(200);

    const after = await testDb.user.findUnique({ where: { email: 'existing@example.com' } });
    expect(after!.googleId).toBe('google-sub-2');
    // existing displayName preserved over Google's value
    expect(after!.displayName).toBe('Existing');
  });

  it('401 when Google rejects the code', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch;

    const res = await POST(
      makeRequest({ code: 'bad', redirectUri: 'https://indlokal.com/cb' }) as never,
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });
});
