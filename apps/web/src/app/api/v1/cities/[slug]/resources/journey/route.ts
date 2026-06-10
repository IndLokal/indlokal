/**
 * GET /api/v1/cities/:slug/resources/journey - Essentials-only resources for
 * a city, grouped by lifecycle stage. PRD/TDD-0030 §6.
 *
 * Stages returned in canonical order:
 *   PRE_ARRIVAL → FIRST_30_DAYS → FIRST_90_DAYS → SETTLED → ANYTIME
 *
 * A resource that targets multiple stages appears in each of its stages.
 * Resources without a stage are returned under `unscheduled`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handlers';
import { getResourcesForCity, type ResolvedResource } from '@/modules/resources';
import type { ResourceStage } from '@prisma/client';

export const runtime = 'nodejs';

const STAGE_ORDER: ResourceStage[] = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
];

function serialize(r: ResolvedResource) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    resourceType: r.resourceType,
    url: r.url,
    description: r.description,
    validFrom: r.validFrom?.toISOString() ?? null,
    validUntil: r.validUntil?.toISOString() ?? null,
    metadata: r.metadata ?? null,
    scope: r.scope,
    resolvedScope: r.resolvedScope,
    priority: r.priority,
    isEssential: r.isEssential,
    lifecycleStage: r.lifecycleStage,
  };
}

export const GET = apiHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;

    const rows = await getResourcesForCity(slug, { essentialsOnly: true });

    const groups: Record<ResourceStage, ReturnType<typeof serialize>[]> = {
      PRE_ARRIVAL: [],
      FIRST_30_DAYS: [],
      FIRST_90_DAYS: [],
      SETTLED: [],
      ANYTIME: [],
    };
    const unscheduled: ReturnType<typeof serialize>[] = [];

    for (const r of rows) {
      const serialized = serialize(r);
      if (r.lifecycleStage.length === 0) {
        unscheduled.push(serialized);
        continue;
      }
      for (const stage of r.lifecycleStage) {
        groups[stage].push(serialized);
      }
    }

    return NextResponse.json({
      citySlug: slug,
      stages: STAGE_ORDER.map((stage) => ({
        stage,
        items: groups[stage],
      })),
      unscheduled,
    });
  },
);
