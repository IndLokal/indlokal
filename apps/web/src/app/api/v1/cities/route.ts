/**
 * GET /api/v1/cities — returns all active cities ordered by name.
 * Public, no auth required. TDD-0003 §3.
 */

import { NextResponse } from 'next/server';
import { getCitiesList } from '@/modules/discovery';

export const runtime = 'nodejs';

export async function GET() {
  const cities = await getCitiesList();
  return NextResponse.json(cities);
}
