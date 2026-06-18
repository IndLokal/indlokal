/**
 * GET /api/v1/me - TDD-0001 §3.
 * Returns the authenticated user's `MeProfile`. First consumer of the
 * `requireAccessToken` middleware.
 *
 * DELETE /api/v1/me - PRD-0019 / TDD-0019.
 * Permanently deletes the authenticated user's account. Revokes all
 * active refresh tokens before deletion so any in-flight sessions are
 * immediately invalidated. Cascades to all related tables via Prisma.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { toMeProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.user.userId },
    include: {
      city: { select: { name: true } },
      roleAssignments: {
        select: { role: true, cityId: true, orgId: true, revokedAt: true },
      },
      claimedCommunities: {
        where: { claimState: 'CLAIMED' },
        select: { id: true, claimedByUserId: true },
      },
    },
  });
  if (!user) return apiError('NOT_FOUND', 'user not found');

  return NextResponse.json(toMeProfile(user));
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  const userId = auth.user.userId;

  // Revoke all active refresh tokens first so any concurrent sessions
  // are immediately invalidated (belt-and-suspenders before cascade delete).
  const revoked = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Delete the user - Prisma cascades to all related tables.
  await db.user.delete({ where: { id: userId } });

  try {
    await db.contentLog.create({
      data: {
        entityType: 'privacy_request',
        entityId: userId,
        action: 'ARCHIVED',
        changedBy: userId,
        metadata: {
          requestType: 'GDPR_DELETE_ACCOUNT_SELF_SERVICE',
          revokedRefreshTokenCount: revoked.count,
          completedAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    // Deletion should complete even if audit persistence is temporarily unavailable.
    console.warn('[GDPR] Failed to record delete-account audit entry:', String(err));
  }

  return NextResponse.json({ ok: true });
});
