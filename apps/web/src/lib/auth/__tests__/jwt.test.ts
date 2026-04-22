/**
 * Unit tests for lib/auth/jwt.ts — TDD-0001 §9 (Test plan: token issue/verify).
 *
 * Uses the ephemeral dev key path (no AUTH_JWT_PRIVATE_KEY in env)
 * so the test is hermetic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetJwtCacheForTests,
  issueAccessToken,
  verifyAccessToken,
  TokenVerificationError,
} from '../jwt';

describe('lib/auth/jwt', () => {
  beforeEach(() => {
    __resetJwtCacheForTests();
  });

  it('issues and verifies an access token round-trip', async () => {
    const { token, expiresAt } = await issueAccessToken({
      userId: 'usr_abc123',
      email: 'jay@example.com',
      role: 'USER',
      jti: 'rt_chain_1',
    });

    expect(token.split('.')).toHaveLength(3); // JWT structure
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const verified = await verifyAccessToken(token);
    expect(verified.userId).toBe('usr_abc123');
    expect(verified.email).toBe('jay@example.com');
    expect(verified.role).toBe('USER');
    expect(verified.jti).toBe('rt_chain_1');
  });

  it('rejects a token signed by a different key', async () => {
    // First issue rotates the dev key on cache reset.
    const { token } = await issueAccessToken({
      userId: 'usr_a',
      email: 'a@example.com',
      role: 'USER',
      jti: 'jti_a',
    });

    __resetJwtCacheForTests(); // forces a brand-new key pair on next call

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a malformed token', async () => {
    await expect(verifyAccessToken('not.a.jwt')).rejects.toBeInstanceOf(TokenVerificationError);
    await expect(verifyAccessToken('garbage')).rejects.toBeInstanceOf(TokenVerificationError);
  });
});
