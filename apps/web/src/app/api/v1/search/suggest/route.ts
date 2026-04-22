/**
 * GET /api/v1/search/suggest?q&citySlug — Autocomplete suggestions.
 * Optional auth.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSuggestions } from '@/modules/search';
import { apiError } from '@/lib/api/error';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const q = url.searchParams.get('q') ?? '';
  if (!q.trim()) {
    return apiError('BAD_REQUEST', 'q is required');
  }

  const citySlug = url.searchParams.get('citySlug') ?? undefined;
  const suggestions = await getSuggestions(q, citySlug);

  return NextResponse.json(suggestions);
}
