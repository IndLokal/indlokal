/**
 * GET /api/v1/cities — returns all active cities ordered by name.
 * Public, no auth required. TDD-0003 §3.
 */

import { NextResponse } from 'next/server';
import { getCitiesList } from '@/modules/discovery';
import { withPublicCache } from '@/lib/api/cache';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  const cities = await getCitiesList();
  return withPublicCache(NextResponse.json(cities), { sMaxAge: 300 });
}
