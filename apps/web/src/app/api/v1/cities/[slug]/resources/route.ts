/**
 * GET /api/v1/cities/:slug/resources?type — City resources, optionally filtered by type.
 * Optional auth. TDD-0010.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getResourcesByCity } from '@/modules/resources';
import { RESOURCE_SLUG_TO_TYPE } from '@/lib/config/resources';
import type { ResourceType } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get('type');

  let resourceType: ResourceType | undefined;
  if (typeParam) {
    // Accept either the enum value (CITY_REGISTRATION) or the slug (city-registration)
    const resolved = (RESOURCE_SLUG_TO_TYPE[typeParam] ?? typeParam) as ResourceType;
    resourceType = resolved;
  }

  const rows = await getResourcesByCity(slug, resourceType);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    resourceType: r.resourceType,
    url: r.url,
    description: r.description,
    validFrom: r.validFrom?.toISOString() ?? null,
    validUntil: r.validUntil?.toISOString() ?? null,
    metadata: r.metadata ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json(items);
}
