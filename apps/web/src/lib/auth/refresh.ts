/**
 * Refresh-token issuance, rotation, and reuse detection — TDD-0001 §2, §8.
 *
 * - Refresh tokens are opaque random strings (NOT JWTs); only their
 *   SHA-256 hash is persisted in the `RefreshToken` table.
 * - On every /auth/refresh call we MUST rotate: the presented token is
 *   marked revoked and a fresh one is issued. The previous row's
 *   `rotatedToId` points at the new row to form a chain.
 * - If a token that has already been rotated (or revoked) is re-presented,
 *   we treat that as compromise: every active row belonging to the same
 *   user is revoked and the caller gets a TOKEN_REUSED error. Mobile/web
 *   then fall back to interactive sign-in.
 */

import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type IssuedRefreshToken = {
  /** Raw token returned to the client; never persisted. */
  token: string;
  /** RefreshToken row id — used as the JWT `jti` for the paired access token. */
  id: string;
  expiresAt: Date;
};

export type RefreshContext = {
  userAgent?: string | null;
  ip?: string | null;
  deviceId?: string | null;
};

function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

/** Mint a brand-new refresh token chain (no parent). Used after sign-in. */
export async function issueRefreshToken(
  userId: string,
  ctx: RefreshContext = {},
): Promise<IssuedRefreshToken> {
  const token = generateOpaqueToken();
  const row = await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: expiry(),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
      deviceId: ctx.deviceId ?? null,
    },
    select: { id: true, expiresAt: true },
  });
  return { token, id: row.id, expiresAt: row.expiresAt };
}

export class RefreshTokenError extends Error {
  constructor(
    public readonly code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_REUSED',
    message: string,
  ) {
    super(message);
    this.name = 'RefreshTokenError';
  }
}

/**
 * Rotate a refresh token. On success returns the new token + the userId it
 * belongs to. On reuse of an already-rotated/revoked token, revokes every
 * active token for the user and throws TOKEN_REUSED.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  ctx: RefreshContext = {},
): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
  const tokenHash = hashToken(presentedToken);
  const existing = await db.refreshToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true, rotatedToId: true },
  });

  if (!existing) {
    throw new RefreshTokenError('TOKEN_INVALID', 'unknown refresh token');
  }

  if (existing.revokedAt || existing.rotatedToId) {
    // Reuse of a token we already retired → likely compromise.
    await db.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new RefreshTokenError('TOKEN_REUSED', 'refresh token already used');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new RefreshTokenError('TOKEN_EXPIRED', 'refresh token expired');
  }

  const newToken = generateOpaqueToken();
  const newRow = await db.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: hashToken(newToken),
      expiresAt: expiry(),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
      deviceId: ctx.deviceId ?? null,
    },
    select: { id: true, expiresAt: true },
  });

  await db.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), rotatedToId: newRow.id },
  });

  return {
    userId: existing.userId,
    refresh: { token: newToken, id: newRow.id, expiresAt: newRow.expiresAt },
  };
}

/** Revoke a single refresh token (logout). Idempotent. */
export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await db.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Test helper — exposed for unit tests only. */
export const __internal = { hashToken, generateOpaqueToken };
