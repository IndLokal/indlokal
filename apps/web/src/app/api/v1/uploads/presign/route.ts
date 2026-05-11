/**
 * POST /api/v1/uploads/presign — Request a presigned PUT URL for a media upload.
 * Requires access token.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { createPresignUrl } from '@/modules/submit';
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

  const parsed = s.PresignRequest.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  let result: s.PresignResponse;
  try {
    result = await createPresignUrl({
      userId: auth.user.userId,
      ...parsed.data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return apiError('INTERNAL', `failed to generate presigned URL: ${msg}`);
  }

  return NextResponse.json(result, { status: 201 });
});
