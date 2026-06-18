import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
} from '@/lib/auth/google-oauth-web';

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  deletedCookies: [] as string[],
  exchangeGoogleCode: vi.fn(),
  fetchGoogleProfile: vi.fn(),
  upsertGoogleUser: vi.fn(),
  persistSessionInDb: vi.fn(async () => undefined),
  captureServerEvent: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name);
      return value ? { value } : undefined;
    },
    delete: (name: string) => {
      mocks.deletedCookies.push(name);
      mocks.cookieValues.delete(name);
    },
  }),
}));

vi.mock('@/lib/auth/google', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth/google')>();
  return {
    ...mod,
    exchangeGoogleCode: mocks.exchangeGoogleCode,
    fetchGoogleProfile: mocks.fetchGoogleProfile,
    upsertGoogleUser: mocks.upsertGoogleUser,
  };
});

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...mod,
    generateSessionToken: vi.fn(() => 'session-token'),
    persistSessionInDb: mocks.persistSessionInDb,
  };
});

vi.mock('@/lib/analytics/server', () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

const { GET } = await import('../route');

function callbackRequest(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return new NextRequest(`http://localhost/auth/google/callback?${search.toString()}`);
}

beforeEach(() => {
  mocks.cookieValues.clear();
  mocks.deletedCookies = [];
  mocks.exchangeGoogleCode.mockReset();
  mocks.fetchGoogleProfile.mockReset();
  mocks.upsertGoogleUser.mockReset();
  mocks.persistSessionInDb.mockReset();
  mocks.captureServerEvent.mockReset();

  mocks.cookieValues.set(GOOGLE_OAUTH_STATE_COOKIE, 'expected-state');
  mocks.cookieValues.set(GOOGLE_OAUTH_VERIFIER_COOKIE, 'pkce-verifier');
});

describe('GET /auth/google/callback', () => {
  it('sets the session cookie on the redirect response after successful login', async () => {
    mocks.exchangeGoogleCode.mockResolvedValueOnce('google-access-token');
    mocks.fetchGoogleProfile.mockResolvedValueOnce({
      sub: 'google-sub-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'User',
    });
    mocks.upsertGoogleUser.mockResolvedValueOnce({
      user: { id: 'user_1' },
      isNewUser: false,
    });

    const response = await GET(
      callbackRequest({
        code: 'auth-code',
        state: 'expected-state',
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/me');
    expect(mocks.persistSessionInDb).toHaveBeenCalledWith('user_1', 'session-token');

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('lp_session=session-token');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });

  it('fails safely when oauth state is invalid and does not set session cookie', async () => {
    const response = await GET(
      callbackRequest({
        code: 'auth-code',
        state: 'wrong-state',
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/me/login?error=google');
    expect(mocks.persistSessionInDb).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
