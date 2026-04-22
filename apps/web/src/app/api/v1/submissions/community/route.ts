/**
 * POST /api/v1/submissions/community — Submit a new community for review.
 * Requires access token.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { createCommunitySubmission } from '@/modules/submit';
import { apiError } from '@/lib/api/error';
import { submit as s } from '@indlokal/shared';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = s.CommunitySubmission.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const item = await createCommunitySubmission(auth.user.userId, parsed.data);
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
    if (err instanceof Error) {
      if (err.message === 'CITY_NOT_FOUND') return apiError('NOT_FOUND', 'city not found');
      if (err.message.startsWith('DUPLICATE:')) {
        const name = err.message.slice('DUPLICATE:'.length);
        return apiError('CONFLICT', `a similar community "${name}" already exists`);
      }
    }
    throw err;
  }
}
