import { describe, expect, it, vi } from 'vitest';

// `invite.ts` is server-only; stub the marker so it imports under Node.
vi.mock('server-only', () => ({}));

import {
  generateInviteToken,
  buildInviteUrl,
  inviteExpiresAt,
  isInviteUsable,
  INVITE_TTL_DAYS,
} from '../invite';

describe('generateInviteToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateInviteToken()).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateInviteToken()));
    expect(tokens.size).toBe(500);
  });
});

describe('buildInviteUrl', () => {
  it('builds an absolute submit URL with the invite query param', () => {
    const url = buildInviteUrl('/jito-stuttgart/business-connect', 'abc123');
    expect(url).toMatch(/\/jito-stuttgart\/business-connect\/submit\?invite=abc123$/);
  });

  it('does not double up slashes from a trailing-slash base', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://indlokal.com/';
    expect(buildInviteUrl('/p/bc', 't')).toBe('https://indlokal.com/p/bc/submit?invite=t');
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('url-encodes the token', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://indlokal.com';
    expect(buildInviteUrl('/p/bc', 'a b&c')).toBe(
      'https://indlokal.com/p/bc/submit?invite=a%20b%26c',
    );
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe('inviteExpiresAt', () => {
  it('returns a date INVITE_TTL_DAYS in the future', () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    const expires = inviteExpiresAt(from);
    const expected = from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBe(expected);
  });
});

describe('isInviteUsable', () => {
  const now = new Date('2025-01-15T00:00:00.000Z');

  it('is usable when unused and unexpired', () => {
    expect(
      isInviteUsable({ usedAt: null, expiresAt: new Date('2025-02-01T00:00:00.000Z') }, now),
    ).toBe(true);
  });

  it('is not usable once used', () => {
    expect(
      isInviteUsable(
        {
          usedAt: new Date('2025-01-10T00:00:00.000Z'),
          expiresAt: new Date('2025-02-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('is not usable once expired', () => {
    expect(
      isInviteUsable({ usedAt: null, expiresAt: new Date('2025-01-10T00:00:00.000Z') }, now),
    ).toBe(false);
  });

  it('is not usable exactly at the expiry instant', () => {
    expect(isInviteUsable({ usedAt: null, expiresAt: now }, now)).toBe(false);
  });
});
