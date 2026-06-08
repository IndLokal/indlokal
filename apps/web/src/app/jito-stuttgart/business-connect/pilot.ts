/**
 * Business Connect — program registry (reusable ecosystem-collaboration framework).
 *
 * The Business Connect *engine* is program-agnostic: the `BusinessConnectSubmission`
 * model, the Zod validation, the submit action, the admin review queue, RBAC
 * (`business_connect.read/.write`), the rate limiter, and the analytics events do
 * NOT bake in any single partner. Each ecosystem partner — a community, business
 * association, professional network, or startup ecosystem — is one entry in this
 * registry plus a thin public landing route that renders the shared form with that
 * program's config.
 *
 * JITO Stuttgart is the first program. Adding another — a future event, an
 * association, or a broader IndLokal Business intake — is additive: add a registry
 * entry (and, if it needs its own branded page, a route folder). No schema change,
 * no logic fork. The generic `/business-connect/[partner]` route resolves a program
 * by its `partnerSlug` and forwards to its `routePath`.
 *
 * This is deliberately NOT a generic, open Business/Connect product. Per
 * `docs/PRODUCT_DOCUMENT.md` §14, Business (Phase 5) and Connect (Phase 6) stay
 * gated and curated until validated. This registry is the seam that keeps future
 * generalization cheap without launching that product now.
 */

/** A single selectable taxonomy option (value persisted, label shown). */
export type BusinessConnectOption = { value: string; label: string };

export type BusinessConnectProgram = {
  /** Stable slug stored on every submission (DB `pilotSlug`). Immutable once live. */
  slug: string;
  /**
   * Short, URL-safe partner key for the generic `/business-connect/[partner]`
   * entry point, e.g. "jito-stuttgart". Stable and human-readable.
   */
  partnerSlug: string;
  /** Partner / organization co-running the program, e.g. "JITO Stuttgart". */
  partnerName: string;
  /** Event/context label shown in the UI, e.g. "JITO Stuttgart Business Event — 23 June". */
  eventLabel: string;
  /** Public route of this program's landing page. */
  routePath: string;
  /** City this program is anchored to, e.g. "/stuttgart" (used for cross-linking). */
  cityPath: string;
  /** Human label for the anchor city, e.g. "Stuttgart". */
  cityLabel: string;
  /**
   * Slug of the community whose organizer curates this program's invite list.
   * Business Connect is invite-only: only the COMMUNITY_ADMIN of this community
   * can issue per-email invites to the submit form. Must match a `Community.slug`.
   */
  communitySlug: string;
  /**
   * Trust-context membership question for this program, e.g. "Are you a JITO
   * member?". The underlying field is the generic `isPartnerMember`; only this
   * label is program-specific.
   */
  membershipQuestion: string;
  /**
   * Privacy-notice version recorded with each submission for GDPR auditability
   * (PRD-0033). Bump per-program whenever its on-form notice/consent copy changes.
   */
  consentPolicyVersion: string;
  /**
   * Optional per-program taxonomy overrides. When omitted, the engine falls back
   * to the shared defaults in `./options`. This lets an association or startup
   * ecosystem present different intents/capabilities without any engine change —
   * the Zod schema derives its enums from the resolved options, so it stays in sync.
   */
  participantTypes?: readonly BusinessConnectOption[];
  lookingForOptions?: readonly BusinessConnectOption[];
  offeringOptions?: readonly BusinessConnectOption[];
};

export const BUSINESS_CONNECT_PROGRAMS = {
  'jito-stuttgart-2026-06-23': {
    slug: 'jito-stuttgart-2026-06-23',
    partnerSlug: 'jito-stuttgart',
    partnerName: 'JITO Stuttgart',
    eventLabel: 'JITO Stuttgart Business Event — 23 June',
    routePath: '/jito-stuttgart/business-connect',
    cityPath: '/stuttgart',
    cityLabel: 'Stuttgart',
    communitySlug: 'jito-stuttgart',
    membershipQuestion: 'Are you a JITO member?',
    consentPolicyVersion: '2026-06-jito-bc-v1',
  },
} as const satisfies Record<string, BusinessConnectProgram>;

export type BusinessConnectProgramSlug = keyof typeof BUSINESS_CONNECT_PROGRAMS;

/**
 * The program currently live on the public JITO route. When a new program launches,
 * add it to the registry above and point its own route at its config; only update
 * this default if it should become the canonical "active" program.
 */
export const ACTIVE_BUSINESS_CONNECT_PROGRAM: BusinessConnectProgram =
  BUSINESS_CONNECT_PROGRAMS['jito-stuttgart-2026-06-23'];

/** Resolve a program by its stored slug, or `undefined` if unknown. */
export function getBusinessConnectProgram(slug: string): BusinessConnectProgram | undefined {
  return (BUSINESS_CONNECT_PROGRAMS as Record<string, BusinessConnectProgram>)[slug];
}

/** Resolve a program by its short `partnerSlug` (used by the generic route). */
export function getBusinessConnectProgramByPartnerSlug(
  partnerSlug: string,
): BusinessConnectProgram | undefined {
  return Object.values(BUSINESS_CONNECT_PROGRAMS as Record<string, BusinessConnectProgram>).find(
    (program) => program.partnerSlug === partnerSlug,
  );
}

/** Resolve a human-readable program label for display (falls back to the raw slug). */
export function businessConnectProgramLabel(slug: string): string {
  return getBusinessConnectProgram(slug)?.eventLabel ?? slug;
}
