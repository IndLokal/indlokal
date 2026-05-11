/**
 * POST /api/v1/submissions/suggest — Suggest a community for IndLokal to add.
 * Requires access token.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { createSuggestSubmission } from '@/modules/submit';
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

  const parsed = s.SuggestSubmission.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const item = await createSuggestSubmission(auth.user.userId, parsed.data);
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
