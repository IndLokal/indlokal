/**
 * Resource classification — duplicates-only.
 *
 * As of PRD/TDD-0030 follow-up, scope / consulate / essential / lifecycle
 * stage / title overrides are authored **inline on each entry** in
 * `prisma/resources.ts`. This file is the lone exception: it lists slugs
 * that should NEVER exist (in fresh DBs) and should be DELETED (from
 * already-seeded legacy environments) because a different canonical row
 * supersedes them.
 *
 * Consumed by:
 *  - `prisma/resources.ts`         — seed skips DUPLICATE_SLUG_SET.
 *  - `prisma/dedupe_resources_v2.ts` — one-shot SQL drops these rows.
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
