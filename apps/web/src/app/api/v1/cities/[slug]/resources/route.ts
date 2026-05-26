/**
 * GET /api/v1/cities/:slug/resources - City resources resolved across all
 * scope tiers (GLOBAL → COUNTRY → STATE → METRO → CITY) with consular
 * jurisdiction filtering. PRD/TDD-0030.
 *
 * Query params (all optional):
 *   type           - ResourceType enum value or slug (city-registration)
 *   audience       - NEWCOMER | FAMILY | FOUNDER | EMPLOYEE | STUDENT | STUDENT_VISA | SENIOR | RETURNEE
 *   stage          - PRE_ARRIVAL | FIRST_30_DAYS | FIRST_90_DAYS | SETTLED | ANYTIME
 *   essentialsOnly - '1' | 'true' to only return rows with isEssential=true
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handlers';
import { getResourcesForCity } from '@/modules/resources';
import { RESOURCE_SLUG_TO_TYPE } from '@/lib/config/resources';
import type { ResourceAudience, ResourceStage, ResourceType } from '@prisma/client';

export const runtime = 'nodejs';

const AUDIENCE_VALUES = new Set<ResourceAudience>([
  'NEWCOMER',
  'FAMILY',
  'FOUNDER',
  'EMPLOYEE',
  'STUDENT',
  'STUDENT_VISA',
  'SENIOR',
  'RETURNEE',
]);

const STAGE_VALUES = new Set<ResourceStage>([
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
]);

function parseTruthy(v: string | null): boolean {
  return v === '1' || v === 'true';
}

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const { searchParams } = new URL(req.url);

    const typeParam = searchParams.get('type');
    const audienceParam = searchParams.get('audience');
    const stageParam = searchParams.get('stage');
    const essentialsOnly = parseTruthy(searchParams.get('essentialsOnly'));

    let resourceType: ResourceType | undefined;
    if (typeParam) {
      // Accept either the enum value (CITY_REGISTRATION) or slug (city-registration)
      resourceType = (RESOURCE_SLUG_TO_TYPE[typeParam] ?? typeParam) as ResourceType;
    }

    const audience =
      audienceParam && AUDIENCE_VALUES.has(audienceParam as ResourceAudience)
        ? (audienceParam as ResourceAudience)
        : undefined;
    const stage =
      stageParam && STAGE_VALUES.has(stageParam as ResourceStage)
        ? (stageParam as ResourceStage)
        : undefined;

    const rows = await getResourcesForCity(slug, {
      type: resourceType,
      audience,
      stage,
      essentialsOnly,
    });

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
      scope: r.scope,
      scopeRegion: r.scopeRegion,
      resolvedScope: r.resolvedScope,
      audiences: r.audiences,
      lifecycleStage: r.lifecycleStage,
      priority: r.priority,
      isEssential: r.isEssential,
    }));

    return NextResponse.json(items);
  },
);
