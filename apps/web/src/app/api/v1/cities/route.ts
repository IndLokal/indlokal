/**
 * GET /api/v1/cities — returns all active cities ordered by name.
 * Public, no auth required. TDD-0003 §3.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handlers';
import { getCitiesList } from '@/modules/discovery';
import { withPublicCache } from '@/lib/api/cache';

export const runtime = 'nodejs';
// Avoid build-time prerender (no DB available in CI). CDN caching is handled by
// the `Cache-Control` header set via `withPublicCache` below.
export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  const cities = await getCitiesList();
  return withPublicCache(NextResponse.json(cities), { sMaxAge: 300 });
});
