import { describe, expect, it, vi } from 'vitest';

// `confirmation.ts` is server-only; stub the marker so it imports under Node.
vi.mock('server-only', () => ({}));

import {
  generateConfirmationToken,
  buildConfirmationUrl,
  isConfirmationFresh,
  CONFIRMATION_TTL_DAYS,
} from '../submit/confirmation';

describe('generateConfirmationToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateConfirmationToken()).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateConfirmationToken()));
    expect(tokens.size).toBe(500);
  });
});

describe('buildConfirmationUrl', () => {
  it('builds an absolute confirm URL with the token query param', () => {
    const url = buildConfirmationUrl('/jito-stuttgart/business-connect', 'abc123');
    expect(url).toMatch(/\/jito-stuttgart\/business-connect\/confirm\?token=abc123$/);
  });

  it('does not double up slashes from a trailing-slash base', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://indlokal.com/';
    expect(buildConfirmationUrl('/p/bc', 't')).toBe('https://indlokal.com/p/bc/confirm?token=t');
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe('isConfirmationFresh', () => {
  const now = new Date('2026-06-20T00:00:00Z');

  it('accepts a token within the validity window', () => {
    const createdAt = new Date(now.getTime() - (CONFIRMATION_TTL_DAYS - 1) * 24 * 60 * 60 * 1000);
    expect(isConfirmationFresh(createdAt, now)).toBe(true);
  });

  it('rejects a token past the validity window', () => {
    const createdAt = new Date(now.getTime() - (CONFIRMATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isConfirmationFresh(createdAt, now)).toBe(false);
  });
});
