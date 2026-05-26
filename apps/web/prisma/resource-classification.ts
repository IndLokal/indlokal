/**
 * Resource classification — single source of truth for PRD/TDD-0030 scope
 * assignment. Used by:
 *
 *  - `prisma/resources.ts` (seed)         — applied inline so a fresh DB
 *                                            ends up correctly scoped.
 *  - `prisma/dedupe_resources_v2.ts`      — applied as one-shot SQL to fix
 *                                            already-seeded environments.
 *
 * Keep this file the only place where the slug → (scope, audience, stage,
 * consulate, essential) mapping lives.
 */

/** Slugs that should be authored / treated as scope=COUNTRY, scopeRegion='DE'. */
export const COUNTRY_SCOPE_SLUGS: readonly string[] = [
  // Bureaucracy & lifecycle
  'guide-abmeldung-germany',
  'guide-emergency-numbers-germany',
  'guide-marriage-registration-germany',
  'guide-niederlassungserlaubnis-pr',
  'guide-verpflichtungserklaerung',
  // Driving
  'guide-driving-licence-conversion',
  'guide-international-driving-permit',
  // Visa & residence
  'guide-eu-blue-card',
  'guide-freelance-visa-germany',
  'guide-family-reunion-visa',
  // Family & money
  'guide-kindergeld-non-eu',
  'guide-elterngeld-parental-allowance',
  'guide-mutterschutz-elternzeit',
  'guide-health-insurance-gkv-pkv',
  // Tax
  'guide-elster-tax-portal',
  'guide-steuererklaerung-basics',
  'guide-steuerberater-english',
  'guide-fragebogen-steuerliche-erfassung',
  'guide-dtaa-india-germany',
  'guide-nre-nro-accounts',
  // Everyday
  'guide-schufa-credit-score',
  'guide-gez-rundfunkbeitrag',
  'guide-online-indian-grocery-germany',
  // Work
  'guide-agentur-fuer-arbeit',
  'guide-job-portals-internationals',
  'guide-freiberufler-vs-gewerbe',
  'guide-gewerbeanmeldung',
  // Indian government / consular portals (untagged COUNTRY — apply to all DE)
  'moia-overseas-indian-resources',
  'passport-seva-renewal-india',
  'oci-card-application-germany',
  'vfs-global-india-germany',
  'pcc-india-germany',
];

/**
 * Duplicate slugs that should NEVER be created (seed skips them) and should
 * be deleted from already-seeded environments (dedupe drops them). The
 * `replacedBy` slug is the canonical COUNTRY-scoped row that supersedes
 * each duplicate.
 */
export const DUPLICATE_SLUGS: ReadonlyArray<{ slug: string; replacedBy: string }> = [
  {
    slug: 'guide-116117-doctor-on-duty-frankfurt',
    replacedBy: 'guide-116117-doctor-on-duty-munich',
  },
  {
    slug: 'guide-116117-doctor-on-duty-karlsruhe',
    replacedBy: 'guide-116117-doctor-on-duty-munich',
  },
  {
    slug: 'guide-116117-doctor-on-duty-mannheim',
    replacedBy: 'guide-116117-doctor-on-duty-munich',
  },
  { slug: 'arbeitsagentur-berlin', replacedBy: 'guide-agentur-fuer-arbeit' },
  { slug: 'arbeitsagentur-karlsruhe', replacedBy: 'guide-agentur-fuer-arbeit' },
  { slug: 'arbeitsagentur-mannheim', replacedBy: 'guide-agentur-fuer-arbeit' },
  { slug: 'elster-karlsruhe', replacedBy: 'guide-elster-tax-portal' },
  { slug: 'elster-munich', replacedBy: 'guide-elster-tax-portal' },
  // CGI Munich BW-city promotions superseded by the canonical service row;
  // BW cities resolve via CONSULAR_JURISDICTION_BY_STATE in the resolver.
  { slug: 'cgi-munich-consular-karlsruhe', replacedBy: 'cgi-munich-consular-services' },
  { slug: 'cgi-munich-consular-mannheim', replacedBy: 'cgi-munich-consular-services' },
  { slug: 'cgi-munich-consular-camp-stuttgart-2026', replacedBy: 'cgi-munich-consular-services' },
  { slug: 'india-house-stuttgart-honorary-consulate', replacedBy: 'cgi-munich-consular-services' },
];

export const DUPLICATE_SLUG_SET: ReadonlySet<string> = new Set(DUPLICATE_SLUGS.map((d) => d.slug));

/**
 * The canonical COUNTRY-scoped 116117 row also needs its title rewritten
 * away from `…-munich` (it's no longer Munich-specific). Applied by both
 * seed (for fresh) and dedupe (for legacy).
 */
export const TITLE_REWRITES: Record<string, { title: string; description: string }> = {
  'guide-116117-doctor-on-duty-munich': {
    title: '116117 — Doctor-on-duty service (Germany-wide)',
    description:
      'Call 116117 anywhere in Germany for non-emergency medical care, including evenings, weekends and public holidays. For life-threatening emergencies always call 112.',
  },
};

/**
 * Slug → consulate identifier. The corresponding rows are COUNTRY-scoped
 * but the resolver only surfaces them when the user's city is in that
 * consulate's jurisdiction (see CONSULAR_JURISDICTION_BY_STATE in
 * `apps/web/src/modules/resources/resolver.ts`).
 */
export const CONSULATE_TAGS: Record<string, 'berlin' | 'frankfurt' | 'munich'> = {
  'cgi-munich-consular-services': 'munich',
  'cgi-frankfurt-consular-services': 'frankfurt',
  'embassy-india-berlin-consular': 'berlin',
  'cgi-munich-national-day-celebrations': 'munich',
};

/**
 * First-30-days essentials surfaced in the journey checklist (priority=80,
 * isEssential=true).
 */
export const ESSENTIAL_SLUGS: readonly string[] = [
  // City-scoped Anmeldung entry points — the moment-zero step.
  'guide-anmeldung-stuttgart',
  'guide-anmeldung-berlin',
  'berlin-buergeramt-locations',
  'buergerbuero-munich',
  'frankfurt-buergerservice',
  'karlsruhe-buergerservice',
  'mannheim-buergerdienste',
  // Country-scoped 30-day essentials.
  'guide-health-insurance-gkv-pkv',
  'guide-steuererklaerung-basics',
  'guide-eu-blue-card',
];

export const ESSENTIAL_SLUG_SET: ReadonlySet<string> = new Set(ESSENTIAL_SLUGS);
