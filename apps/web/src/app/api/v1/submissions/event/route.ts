/**
 * POST /api/v1/submissions/event — Submit a new event for review.
 * Requires access token.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { createEventSubmission } from '@/modules/submit';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { submit as s } from '@indlokal/shared';

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = s.EventSubmission.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const item = await createEventSubmission(auth.user.userId, parsed.data);
    return NextResponse.json(
      {
        id: item.id,
        entityType: item.entityType,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CITY_NOT_FOUND') {
      return apiError('NOT_FOUND', 'city not found');
    }
    throw err;
  }
});
