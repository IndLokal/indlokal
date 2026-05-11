/**
 * GET /api/v1/search/trending?citySlug — Trending search terms.
 * Optional auth.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handlers';
import { getTrendingKeywords } from '@/modules/search';
import { withPublicCache } from '@/lib/api/cache';

export const revalidate = 60;

export const GET = apiHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const citySlug = url.searchParams.get('citySlug') ?? undefined;

  const keywords = await getTrendingKeywords(citySlug);

  return withPublicCache(NextResponse.json(keywords), { sMaxAge: 60 });
});
