/**
 * Unit tests for the app → web hand-off routes (TDD-0058).
 *
 * Mocks the helper, middleware, session, analytics, and the feature flag so we
 * assert control flow (flag gating, auth gating, redirects) without a database
 * or cookie plumbing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  flags: { authWebHandoffEnabled: true },
  requireAccessToken: vi.fn(),
  mintWebHandoffToken: vi.fn(),
  consumeWebHandoffToken: vi.fn(),
  createSession: vi.fn(async () => undefined),
  captureServerEvent: vi.fn(),
}));

vi.mock('@/lib/config/flags', () => ({ FLAGS: mocks.flags }));
vi.mock('@/lib/auth/middleware', () => ({ requireAccessToken: mocks.requireAccessToken }));
vi.mock('@/lib/auth/web-handoff', () => ({
  mintWebHandoffToken: mocks.mintWebHandoffToken,
  consumeWebHandoffToken: mocks.consumeWebHandoffToken,
}));
vi.mock('@/lib/session', () => ({
  createSession: mocks.createSession,
  generateSessionToken: vi.fn(() => 'session-token'),
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: mocks.captureServerEvent }));

const { POST } = await import('../route');
const { GET } = await import('@/app/auth/handoff/route');

function mintRequest(body: unknown, token = 'jwt') {
  return new NextRequest('http://localhost/api/v1/auth/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.flags.authWebHandoffEnabled = true;
  mocks.requireAccessToken.mockReset();
  mocks.mintWebHandoffToken.mockReset();
  mocks.consumeWebHandoffToken.mockReset();
  mocks.createSession.mockReset();
  mocks.captureServerEvent.mockReset();
});

describe('POST /api/v1/auth/handoff', () => {
  it('404s when the feature flag is off', async () => {
    mocks.flags.authWebHandoffEnabled = false;
    const res = await POST(mintRequest({ next: '/me' }));
    expect(res.status).toBe(404);
    expect(mocks.requireAccessToken).not.toHaveBeenCalled();
  });

  it('returns the auth failure response when unauthenticated', async () => {
    mocks.requireAccessToken.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }),
    });
    const res = await POST(mintRequest({ next: '/me' }));
    expect(res.status).toBe(401);
    expect(mocks.mintWebHandoffToken).not.toHaveBeenCalled();
  });

  it('mints a hand-off URL for an authenticated user', async () => {
    mocks.requireAccessToken.mockResolvedValueOnce({ ok: true, user: { userId: 'user_1' } });
    const expiresAt = new Date(Date.now() + 90_000);
    mocks.mintWebHandoffToken.mockResolvedValueOnce({
      url: 'https://indlokal.com/auth/handoff?token=tok',
      expiresAt,
      next: '/me',
    });

    const res = await POST(mintRequest({ next: '/me' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://indlokal.com/auth/handoff?token=tok');
    expect(json.expiresAt).toBe(expiresAt.toISOString());
    expect(mocks.mintWebHandoffToken).toHaveBeenCalledWith({ userId: 'user_1', next: '/me' });
  });

  it('400s on an invalid body', async () => {
    mocks.requireAccessToken.mockResolvedValueOnce({ ok: true, user: { userId: 'user_1' } });
    const res = await POST(mintRequest({ next: 123 }));
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/handoff', () => {
  function consumeRequest(token?: string) {
    const url = token
      ? `http://localhost/auth/handoff?token=${token}`
      : 'http://localhost/auth/handoff';
    return new NextRequest(url, { method: 'GET' });
  }

  it('404s when the feature flag is off', async () => {
    mocks.flags.authWebHandoffEnabled = false;
    const res = await GET(consumeRequest('tok'));
    expect(res.status).toBe(404);
    expect(mocks.consumeWebHandoffToken).not.toHaveBeenCalled();
  });

  it('redirects to the login error page when the token is missing', async () => {
    const res = await GET(consumeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/me/login?error=handoff');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('redirects to the login error page for an invalid token', async () => {
    mocks.consumeWebHandoffToken.mockResolvedValueOnce(null);
    const res = await GET(consumeRequest('bad'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/me/login?error=handoff');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('establishes a session and redirects to next for a valid token', async () => {
    mocks.consumeWebHandoffToken.mockResolvedValueOnce({ userId: 'user_1', next: '/organizer' });
    const res = await GET(consumeRequest('good'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/organizer');
    expect(mocks.createSession).toHaveBeenCalledWith('user_1', 'session-token');
  });
});
