/**
 * Integration tests for GET/DELETE /api/v1/me handlers.
 *
 * @db - requires test database
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

import { DELETE } from '@/app/api/v1/me/route';

const USER_ID = 'user-me-delete-test-01';

function makeDELETE(headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/v1/me', {
    method: 'DELETE',
    headers,
  });
}

beforeEach(async () => {
  await cleanDb();

  await testDb.user.create({
    data: {
      id: USER_ID,
      email: `${USER_ID}@example.test`,
      role: 'USER',
    },
  });

  await testDb.refreshToken.createMany({
    data: [
      {
        userId: USER_ID,
        tokenHash: `${USER_ID}-token-hash-1`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      {
        userId: USER_ID,
        tokenHash: `${USER_ID}-token-hash-2`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    ],
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('DELETE /api/v1/me', () => {
  it('returns 401 without token', async () => {
    const res = await DELETE(makeDELETE({}));
    expect(res.status).toBe(401);
  });

  it('deletes the authenticated user and records a privacy audit row', async () => {
    const headers = await bearerHeaders({ userId: USER_ID });
    const res = await DELETE(makeDELETE(headers));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const user = await testDb.user.findUnique({ where: { id: USER_ID } });
    expect(user).toBeNull();

    const log = await testDb.contentLog.findFirst({
      where: {
        entityType: 'privacy_request',
        entityId: USER_ID,
        action: 'ARCHIVED',
        changedBy: USER_ID,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.metadata).toMatchObject({
      requestType: 'GDPR_DELETE_ACCOUNT_SELF_SERVICE',
      revokedRefreshTokenCount: 2,
    });
  });
});
