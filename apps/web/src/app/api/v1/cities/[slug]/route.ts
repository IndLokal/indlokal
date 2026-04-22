/**
 * GET /api/v1/cities/:slug — city detail with counts + category grid.
 * Public, no auth required. TDD-0003 §3.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/error';
import { getCityDetail } from '@/modules/discovery';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const city = await getCityDetail(slug);
  if (!city) return apiError('NOT_FOUND', 'city not found');
  return NextResponse.json(city);
}
