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
