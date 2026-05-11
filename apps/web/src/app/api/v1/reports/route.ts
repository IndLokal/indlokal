/**
 * POST /api/v1/reports — Submit a content report.
 * Requires access token. Feature-flagged via FEATURE_REPORT env var. TDD-0010.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAccessToken } from '@/lib/auth/middleware';
import { createReport } from '@/modules/report';
import { apiError } from '@/lib/api/error';
import { apiHandler } from '@/lib/api/handlers';
import { FLAGS } from '@/lib/config/flags';
import { resources as r } from '@indlokal/shared';

export const runtime = 'nodejs';

export const POST = apiHandler(async (req: NextRequest) => {
  if (!FLAGS.reportEnabled) {
    return apiError('NOT_FOUND', 'reports are not enabled');
  }

  const auth = await requireAccessToken(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = r.ContentReportInput.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const report = await createReport(auth.user.userId, parsed.data);
    return NextResponse.json(
      {
        id: report.id,
        reportType: report.reportType,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'COMMUNITY_NOT_FOUND') {
      return apiError('NOT_FOUND', 'community not found');
    }
    throw err;
  }
});
