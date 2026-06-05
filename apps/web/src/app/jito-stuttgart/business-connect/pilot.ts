/**
 * Business Connect — pilot registry.
 *
 * The Business Connect *engine* is pilot-agnostic: the `BusinessConnectSubmission`
 * model, the Zod validation, the submit action, the admin review queue, RBAC
 * (`business_connect.read/.write`), the rate limiter, and the analytics events do
 * NOT bake in any single event. Each pilot is one entry in this registry plus a
 * thin public landing route that renders the shared form with that pilot's config.
 *
 * JITO Stuttgart is the first pilot. Adding another — a future event, or a broader
 * IndLokal Business intake — is additive: add a registry entry (and, if it needs
 * its own branded page, a route folder). No schema change, no logic fork.
 *
 * This is deliberately NOT a generic, open Business/Connect product. Per
 * `docs/PRODUCT_DOCUMENT.md` §14, Business (Phase 5) and Connect (Phase 6) stay
 * gated and curated until validated. This registry is the seam that keeps future
 * generalization cheap without launching that product now.
 */

export type BusinessConnectPilot = {
  /** Stable slug stored on every submission. Immutable once a pilot is live. */
  slug: string;
  /** Partner / community co-running the pilot, e.g. "JITO Stuttgart". */
  partnerName: string;
  /** Event/context label shown in the UI, e.g. "JITO Stuttgart Business Event — 23 June". */
  eventLabel: string;
  /** Public route of this pilot's landing page. */
  routePath: string;
  /** City this pilot is anchored to, e.g. "/stuttgart" (used for cross-linking). */
  cityPath: string;
  /** Human label for the anchor city, e.g. "Stuttgart". */
  cityLabel: string;
  /**
   * Slug of the community whose organizer curates this pilot's invite list.
   * Business Connect is invite-only: only the COMMUNITY_ADMIN of this community
   * can issue per-email invites to the submit form. Must match a `Community.slug`.
   */
  communitySlug: string;
  /**
   * Trust-context membership question for this pilot, e.g. "Are you a JITO
   * member?". The underlying field is the generic `isPartnerMember`; only this
   * label is pilot-specific.
   */
  membershipQuestion: string;
  /**
   * Privacy-notice version recorded with each submission for GDPR auditability
   * (PRD-0033). Bump per-pilot whenever its on-form notice/consent copy changes.
   */
  consentPolicyVersion: string;
};

export const BUSINESS_CONNECT_PILOTS = {
  'jito-stuttgart-2026-06-23': {
    slug: 'jito-stuttgart-2026-06-23',
    partnerName: 'JITO Stuttgart',
    eventLabel: 'JITO Stuttgart Business Event — 23 June',
    routePath: '/jito-stuttgart/business-connect',
    cityPath: '/stuttgart',
    cityLabel: 'Stuttgart',
    communitySlug: 'jito-stuttgart',
    membershipQuestion: 'Are you a JITO member?',
    consentPolicyVersion: '2026-06-jito-bc-v1',
  },
} as const satisfies Record<string, BusinessConnectPilot>;

export type BusinessConnectPilotSlug = keyof typeof BUSINESS_CONNECT_PILOTS;

/**
 * The pilot currently live on the public JITO route. When a new pilot launches,
 * add it to the registry above and point its own route at its config; only update
 * this default if it should become the canonical "active" pilot.
 */
export const ACTIVE_BUSINESS_CONNECT_PILOT: BusinessConnectPilot =
  BUSINESS_CONNECT_PILOTS['jito-stuttgart-2026-06-23'];

/** Resolve a pilot by slug, or `undefined` if the slug is not a known pilot. */
export function getBusinessConnectPilot(slug: string): BusinessConnectPilot | undefined {
  return (BUSINESS_CONNECT_PILOTS as Record<string, BusinessConnectPilot>)[slug];
}

/** Resolve a human-readable pilot label for display (falls back to the raw slug). */
export function businessConnectPilotLabel(slug: string): string {
  return getBusinessConnectPilot(slug)?.eventLabel ?? slug;
}
