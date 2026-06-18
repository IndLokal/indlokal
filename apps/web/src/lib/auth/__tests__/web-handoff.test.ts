/**
 * Unit tests for the web hand-off helper (TDD-0058).
 *
 * Mocks `@/lib/db` with an in-memory store and `@/lib/session` so the
 * single-use / expiry / next-validation logic is exercised without a database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  tokenHash: string;
  userId: string;
  next: string | null;
  expiresAt: Date;
  usedAt: Date | null;
};

const store = vi.hoisted(() => ({ rows: [] as unknown[], seq: 0 }));

vi.mock('@/lib/db', () => ({
  db: {
    webHandoffToken: {
      async create({ data }: { data: Omit<Row, 'id' | 'usedAt'> }) {
        const row: Row = { id: `h${++store.seq}`, usedAt: null, ...data };
        store.rows.push(row);
        return row;
      },
      async findUnique({ where: { tokenHash } }: { where: { tokenHash: string } }) {
        return (store.rows as Row[]).find((r) => r.tokenHash === tokenHash) ?? null;
      },
      async updateMany({
        where: { id, usedAt },
        data,
      }: {
        where: { id: string; usedAt: null };
        data: { usedAt: Date };
      }) {
        const row = (store.rows as Row[]).find((r) => r.id === id && r.usedAt === usedAt);
        if (!row) return { count: 0 };
        row.usedAt = data.usedAt;
        return { count: 1 };
      },
    },
  },
}));

vi.mock('@/lib/session', () => ({
  generateSessionToken: vi.fn(() => 'raw-token-fixture'),
  hashToken: vi.fn(async (t: string) => `hash(${t})`),
}));

const { safeNextPath, mintWebHandoffToken, consumeWebHandoffToken, WEB_HANDOFF_DEFAULT_NEXT } =
  await import('../web-handoff');

beforeEach(() => {
  store.rows = [];
  store.seq = 0;
});

describe('safeNextPath', () => {
  it('keeps a safe in-product path', () => {
    expect(safeNextPath('/organizer/host')).toBe('/organizer/host');
    expect(safeNextPath('/me?tab=saved')).toBe('/me?tab=saved');
  });

  it('falls back to the default for unsafe or empty values', () => {
    expect(safeNextPath(undefined)).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect(safeNextPath('')).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect(safeNextPath('https://evil.example.com')).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect(safeNextPath('//evil.example.com')).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect(safeNextPath('/foo\\bar')).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect(safeNextPath('me')).toBe(WEB_HANDOFF_DEFAULT_NEXT);
  });
});

describe('mintWebHandoffToken', () => {
  it('persists a hashed token and returns a URL containing the raw token', async () => {
    const minted = await mintWebHandoffToken({ userId: 'user_1', next: '/me' });

    expect(minted.next).toBe('/me');
    expect(minted.url).toContain('/auth/handoff?token=raw-token-fixture');
    expect(minted.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const row = (store.rows as Row[])[0];
    expect(row.tokenHash).toBe('hash(raw-token-fixture)');
    expect(row.userId).toBe('user_1');
    expect(row.next).toBe('/me');
    expect(row.usedAt).toBeNull();
  });

  it('normalizes an unsafe next before persisting', async () => {
    const minted = await mintWebHandoffToken({
      userId: 'user_1',
      next: 'https://evil.example.com',
    });
    expect(minted.next).toBe(WEB_HANDOFF_DEFAULT_NEXT);
    expect((store.rows as Row[])[0].next).toBe(WEB_HANDOFF_DEFAULT_NEXT);
  });
});

describe('consumeWebHandoffToken', () => {
  it('returns the user + next for a fresh token and marks it used', async () => {
    await mintWebHandoffToken({ userId: 'user_1', next: '/organizer' });

    const result = await consumeWebHandoffToken('raw-token-fixture');
    expect(result).toEqual({ userId: 'user_1', next: '/organizer' });
    expect((store.rows as Row[])[0].usedAt).not.toBeNull();
  });

  it('is single-use: a second consume returns null', async () => {
    await mintWebHandoffToken({ userId: 'user_1', next: '/me' });
    await consumeWebHandoffToken('raw-token-fixture');

    const second = await consumeWebHandoffToken('raw-token-fixture');
    expect(second).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    expect(await consumeWebHandoffToken('nope')).toBeNull();
  });

  it('returns null for an expired token', async () => {
    await mintWebHandoffToken({ userId: 'user_1', next: '/me' });
    // Force expiry in the stored row.
    (store.rows as Row[])[0].expiresAt = new Date(Date.now() - 1000);

    expect(await consumeWebHandoffToken('raw-token-fixture')).toBeNull();
  });
});
