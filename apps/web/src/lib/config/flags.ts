/**
 * Feature flags - controlled via environment variables.
 * All flags default to enabled unless explicitly disabled with `=false`.
 */
export const FLAGS = {
  /** Report & suggest flows (POST /api/v1/reports). Disable via FEATURE_REPORT=false */
  reportEnabled: process.env.FEATURE_REPORT !== 'false',

  /**
   * Journey Layer (PRD/TDD-0052). Additive and inert when off. Defaults to
   * OFF — enable explicitly with JOURNEY_LAYER_ENABLED=true. When off, journey
   * routes/pages return 404 and entry points are not rendered.
   */
  journeyLayerEnabled: process.env.JOURNEY_LAYER_ENABLED === 'true',

  /**
   * Journey tag suggestions in the AI pipeline (PRD/TDD-0053). When ON, the
   * pipeline SUGGESTS persona/audience/stage tags into PipelineItem.metadata;
   * tags are only ever written to live content when a human approves the item
   * (ADR-0006 L0 gate). Defaults to OFF — pipeline behaviour is unchanged when
   * disabled. Enable explicitly with JOURNEY_TAG_SUGGESTIONS_ENABLED=true.
   */
  journeyTagSuggestionsEnabled: process.env.JOURNEY_TAG_SUGGESTIONS_ENABLED === 'true',

  /** Resources persona quick-start modules. Disable via FEATURE_RESOURCES_PERSONA=false */
  resourcesPersonaEnabled: process.env.FEATURE_RESOURCES_PERSONA !== 'false',

  /** Resources intent chips + smart essentials. Disable via FEATURE_RESOURCES_INTENT=false */
  resourcesIntentEnabled: process.env.FEATURE_RESOURCES_INTENT !== 'false',

  /** Resume-first modules on resources/journey surfaces. Disable via FEATURE_RESOURCES_RESUME=false */
  resourcesJourneyResumeEnabled: process.env.FEATURE_RESOURCES_RESUME !== 'false',

  /** Action-first CTA hierarchy rollout for resources surfaces. Disable via FEATURE_RESOURCES_CTA=false */
  resourcesActionCtaEnabled: process.env.FEATURE_RESOURCES_CTA !== 'false',
} as const;

/**
 * Which (city, persona) journeys are allowed to render, regardless of density.
 * Comma-separated `citySlug:personaSlug` pairs; `*` allows any. Defaults to the
 * first launch journey (Stuttgart × Young Family) per PRD-0052.
 */
const JOURNEY_ALLOWLIST_RAW =
  process.env.JOURNEY_CITY_PERSONA_ALLOWLIST ?? 'stuttgart:young-family';

const JOURNEY_ALLOWLIST = new Set(
  JOURNEY_ALLOWLIST_RAW.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** True when a city×persona journey may be served (flag + allowlist). */
export function isJourneyAllowed(citySlug: string, personaSlug: string): boolean {
  if (!FLAGS.journeyLayerEnabled) return false;
  if (JOURNEY_ALLOWLIST.has('*')) return true;
  return JOURNEY_ALLOWLIST.has(`${citySlug.toLowerCase()}:${personaSlug.toLowerCase()}`);
}
