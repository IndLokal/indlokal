/**
 * GET /api/v1/cities/:slug/journey - The composed Journey Layer for a city
 * and persona. PRD/TDD-0052, ADR-0011.
 *
 * Query params:
 *   persona  (required)  one of JourneyPersona, e.g. FAMILY
 *   stage    (optional)  restrict to a single ResourceStage
 *   lang     (optional)  language hint (default "en")
 *
 * Returns a `JourneyView` composed over existing tagged data. Flag-gated by
 * JOURNEY_LAYER_ENABLED + the city×persona allowlist; returns 404 when the
 * journey is not enabled, the city is inactive, or the persona is unknown.
 *
 * The legacy `GET .../resources/journey` route is unchanged (back-compat).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { journeys as j } from '@indlokal/shared';
import { apiHandler } from '@/lib/api/handlers';
import { apiError } from '@/lib/api/error';
import { db } from '@/lib/db';
import { isJourneyAllowed } from '@/lib/config';
import { composeJourney, getPersonaDefinition, type JourneyPersona } from '@/modules/journeys';

export const runtime = 'nodejs';

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const { searchParams } = new URL(req.url);

    const personaParsed = j.JourneyPersona.safeParse(searchParams.get('persona'));
    if (!personaParsed.success) {
      return apiError('BAD_REQUEST', 'unknown or missing persona');
    }
    const persona = personaParsed.data as JourneyPersona;
    const def = getPersonaDefinition(persona);

    const stageRaw = searchParams.get('stage');
    const stageParsed = stageRaw
      ? j.JourneyView.shape.stages.element.shape.stage.safeParse(stageRaw)
      : null;
    if (stageRaw && (!stageParsed || !stageParsed.success)) {
      return apiError('BAD_REQUEST', 'invalid stage');
    }

    if (!isJourneyAllowed(slug, def.slug)) {
      return apiError('NOT_FOUND', 'journey not available');
    }

    const city = await db.city.findUnique({
      where: { slug },
      select: { name: true, isActive: true },
    });
    if (!city || !city.isActive) {
      return apiError('NOT_FOUND', 'city not found');
    }

    const view = await composeJourney({
      persona,
      citySlug: slug,
      cityName: city.name,
      ...(stageParsed?.success && { stage: stageParsed.data }),
      language: searchParams.get('lang') ?? 'en',
    });

    return NextResponse.json(view);
  },
);
