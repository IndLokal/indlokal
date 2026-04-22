/**
 * Integration tests — refresh-token rotation and reuse detection.
 *
 * @db — requires test database (`./dev.sh test:setup`).
 * Covers TDD-0001 §2 and §8.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';

// Redirect the module-level `db` singleton to indlokal_test.
vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

const {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  RefreshTokenError,
} = await import('../refresh');

async function createUser() {
  return testDb.user.create({
    data: {
      email: `${Math.random().toString(36).slice(2)}@example.com`,
      role: 'USER',
    },
    select: { id: true },
  });
}

describe('refresh tokens', () => {
  beforeEach(() => cleanDb());
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('issues a token whose hash is persisted (not the raw value)', async () => {
    const user = await createUser();
    const issued = await issueRefreshToken(user.id);
    expect(issued.token).toMatch(/^[a-f0-9]{64}$/);

    const row = await testDb.refreshToken.findUnique({ where: { id: issued.id } });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).not.toBe(issued.token);
    expect(row!.userId).toBe(user.id);
    expect(row!.revokedAt).toBeNull();
  });

  it('rotation revokes the old row, links chain, and returns a fresh token', async () => {
    const user = await createUser();
    const first = await issueRefreshToken(user.id);
    const rotated = await rotateRefreshToken(first.token);

    expect(rotated.userId).toBe(user.id);
    expect(rotated.refresh.token).not.toBe(first.token);
    expect(rotated.refresh.id).not.toBe(first.id);

    const oldRow = await testDb.refreshToken.findUnique({ where: { id: first.id } });
    expect(oldRow!.revokedAt).not.toBeNull();
    expect(oldRow!.rotatedToId).toBe(rotated.refresh.id);
  });

  it('reusing a rotated token throws TOKEN_REUSED and revokes the entire chain', async () => {
    const user = await createUser();
    const first = await issueRefreshToken(user.id);
    const second = await rotateRefreshToken(first.token);

    await expect(rotateRefreshToken(first.token)).rejects.toMatchObject({
      code: 'TOKEN_REUSED',
    });

    const stillActive = await testDb.refreshToken.findFirst({
      where: { userId: user.id, revokedAt: null },
    });
    expect(stillActive).toBeNull();

    // The freshly minted token from the rotation is also dead now.
    await expect(rotateRefreshToken(second.refresh.token)).rejects.toMatchObject({
      code: 'TOKEN_REUSED',
    });
  });

  it('rejects an unknown token with TOKEN_INVALID', async () => {
    await expect(rotateRefreshToken('not-a-real-token')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const user = await createUser();
    const issued = await issueRefreshToken(user.id);
    await testDb.refreshToken.update({
      where: { id: issued.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(rotateRefreshToken(issued.token)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });

  it('revokeRefreshToken is idempotent', async () => {
    const user = await createUser();
    const issued = await issueRefreshToken(user.id);
    await revokeRefreshToken(issued.token);
    await revokeRefreshToken(issued.token);
    const row = await testDb.refreshToken.findUnique({ where: { id: issued.id } });
    expect(row!.revokedAt).not.toBeNull();
  });

  it('exports a usable error class', () => {
    expect(new RefreshTokenError('TOKEN_INVALID', 'x').code).toBe('TOKEN_INVALID');
  });
});
