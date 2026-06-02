import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  createMagicLinkToken: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mocked.findUserByEmail,
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendMagicLinkEmail: mocked.sendMagicLinkEmail,
}));

vi.mock('@/lib/session', () => ({
  createMagicLinkToken: mocked.createMagicLinkToken,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocked.checkRateLimit,
  magicLinkLimiter: { name: 'magic-link' },
  magicLinkIpLimiter: { name: 'magic-link-ip' },
  magicLinkGlobalLimiter: { name: 'magic-link-global' },
  MAGIC_LINK_GLOBAL_KEY: '__global__',
}));

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/magic-link/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/magic-link/request redirect handling', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://indlokal.com';

    mocked.findUserByEmail.mockReset();
    mocked.sendMagicLinkEmail.mockReset();
    mocked.createMagicLinkToken.mockReset();
    mocked.checkRateLimit.mockReset();

    mocked.findUserByEmail.mockResolvedValue({ id: 'user_1' });
    mocked.createMagicLinkToken.mockResolvedValue('token_123');
    mocked.sendMagicLinkEmail.mockResolvedValue(undefined);
    mocked.checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
  });

  it('uses trusted https redirectTo and appends token', async () => {
    const res = await POST(
      makeRequest({
        email: 'member@example.com',
        redirectTo: 'https://indlokal.com/auth/magic?from=email',
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mocked.sendMagicLinkEmail).toHaveBeenCalledTimes(1);

    const verifyUrl = mocked.sendMagicLinkEmail.mock.calls[0]?.[3] as string;
    const parsed = new URL(verifyUrl);

    expect(parsed.origin).toBe('https://indlokal.com');
    expect(parsed.pathname).toBe('/auth/magic');
    expect(parsed.searchParams.get('from')).toBe('email');
    expect(parsed.searchParams.get('token')).toBe('token_123');
  });

  it('allows indlokal:// redirectTo and appends token', async () => {
    const res = await POST(
      makeRequest({
        email: 'member@example.com',
        redirectTo: 'indlokal://auth/magic?from=email',
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mocked.sendMagicLinkEmail).toHaveBeenCalledTimes(1);

    const verifyUrl = mocked.sendMagicLinkEmail.mock.calls[0]?.[3] as string;
    const parsed = new URL(verifyUrl);

    expect(parsed.protocol).toBe('indlokal:');
    expect(parsed.hostname).toBe('auth');
    expect(parsed.pathname).toBe('/magic');
    expect(parsed.searchParams.get('from')).toBe('email');
    expect(parsed.searchParams.get('token')).toBe('token_123');
  });

  it('falls back to /auth/magic for untrusted redirectTo hosts', async () => {
    const res = await POST(
      makeRequest({
        email: 'member@example.com',
        redirectTo: 'https://evil.example/phish',
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mocked.sendMagicLinkEmail).toHaveBeenCalledTimes(1);

    const verifyUrl = mocked.sendMagicLinkEmail.mock.calls[0]?.[3] as string;
    const parsed = new URL(verifyUrl);

    expect(parsed.origin).toBe('https://indlokal.com');
    expect(parsed.pathname).toBe('/auth/magic');
    expect(parsed.searchParams.get('token')).toBe('token_123');
  });

  it('does not send an email when account does not exist', async () => {
    mocked.findUserByEmail.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'missing@example.com' }) as never);

    expect(res.status).toBe(200);
    expect(mocked.sendMagicLinkEmail).not.toHaveBeenCalled();
  });
});
