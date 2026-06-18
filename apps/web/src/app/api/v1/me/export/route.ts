/**
 * GET /api/v1/me/export - GDPR portability export for the authenticated user.
 * Returns a JSON snapshot of account-linked data without secrets.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { requireAccessToken } from '@/lib/auth/middleware';
import { buildMeDataExport } from '@/lib/auth/me-export';

export const runtime = 'nodejs';

export const GET = apiHandler(async (req: NextRequest) => {
  const authn = await requireAccessToken(req);
  if (!authn.ok) return authn.response;

  const userId = authn.user.userId;
  const parsed = await buildMeDataExport(userId, 'API_V1_BEARER');
  if (!parsed) return apiError('NOT_FOUND', 'user not found');

  return NextResponse.json(parsed);
});
