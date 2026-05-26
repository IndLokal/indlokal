/**
 * Resources seed — curated public knowledge base.
 *
 * Tier 2 of 3 (sibling of directory.ts). See
 * docs/deployment/ADMIN_AND_BOOTSTRAP.md §7 for the editorial policy.
 *
 * Purpose
 * ───────
 * Resources are factual content about official processes, government
 * services, and integration topics relevant to Indian residents in Germany.
 * They are seeded into every environment (dev / staging / prod) because
 * they are stable, factual, and have lasting value.
 *
 * Hard rules — same as the community directory
 * ────────────────────────────────────────────
 * 1. Factual content only. No marketing copy. No opinions.
 * 2. Every resource needs evidence: either a public `url` or an official
 *    evidence URL from the resource-type fallback table below. Never republish
 *    copyrighted prose without attribution.
 * 3. Idempotent and create-only. Existing rows are NEVER updated or hidden by
 *    this script — admin edits must survive every redeploy. Live-data cleanup
 *    belongs in the explicit seed-cleanup script, not in this seed runner.
 * 4. No personal data. No event dates that go stale.
 * 5. When facts change (fees, deadlines, addresses), update via the admin
 *    UI in prod or fix here and bump the slug — do NOT silently rewrite
 *    existing rows.
 *
 * Run manually:   pnpm --filter web db:resources
 * Run on deploy:  invoked transitively by runDirectorySeed().
 */

import {
  PrismaClient,
  type ResourceType,
  type ResourceScope,
  type ResourceAudience,
  type ResourceStage,
  type Prisma,
} from '@prisma/client';
import { assessEvidenceUrl, getQualifyingEvidence } from '../src/lib/source-policy';
import { DUPLICATE_SLUG_SET } from './resource-classification';

const prisma = new PrismaClient();

const SEED_REVIEWED_AT = new Date('2026-05-22T00:00:00.000Z');
const DEFAULT_REVIEW_CADENCE_DAYS = 180;

const RESOURCE_TYPE_EVIDENCE_URLS: Partial<Record<ResourceType, string[]>> = {
  CONSULAR_SERVICE: ['https://www.cgimunich.gov.in/pages/Mjc2'],
  OFFICIAL_EVENT: ['https://www.cgimunich.gov.in/eventgallery'],
  GOVERNMENT_INFO: ['https://www.make-it-in-germany.com/en/', 'https://www.verwaltung.bund.de/'],
  VISA_SERVICE: [
    'https://www.cgimunich.gov.in/pages/Mjc2',
    'https://www.vfsglobal.com/India/Germany',
  ],
  CITY_REGISTRATION: [
    'https://www.stuttgart.de/service/dienstleistungen/',
    'https://www.make-it-in-germany.com/en/living-in-germany',
  ],
  DRIVING: ['https://www.bmv.de/EN/Home/home.html'],
  HOUSING: ['https://www.stuttgart.de/leben/wohnen/', 'https://www.schufa.de/'],
  HEALTH_DOCTORS: ['https://www.116117.de/', 'https://gesund.bund.de/en'],
  FAMILY_CHILDREN: ['https://familienportal.de/'],
  JOBS_CAREERS: ['https://www.arbeitsagentur.de/', 'https://www.make-it-in-germany.com/en/'],
  TAX_FINANCE: ['https://www.elster.de', 'https://www.bundesfinanzministerium.de/'],
  BUSINESS_SETUP: ['https://www.service-bw.de/', 'https://www.verwaltung.bund.de/'],
};

export type ResourceEntry = {
  title: string;
  slug: string;
  resourceType: ResourceType;
  /** Official source URL, or null for self-authored process guides. */
  url: string | null;
  /** Official evidence URLs for self-authored guides when the public URL is null. */
  evidenceUrls?: string[];
  description: string;
  /** Optional city slug to scope the resource. Defaults to Stuttgart for now. */
  citySlug?: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
  lastReviewedAt?: Date | null;
  reviewCadenceDays?: number;
  // PRD/TDD-0030 additions — defaults derived in the seeder when absent.
  scope?: ResourceScope;
  /** Indian consular post that should surface this entry (resolver-aware). */
  consulate?: 'berlin' | 'frankfurt' | 'munich';
  /**
   * Region identifier for the scope:
   *  - GLOBAL  → null
   *  - COUNTRY → 'DE'
   *  - STATE   → ISO state code, e.g. 'DE-BW'
   *  - METRO   → metro city slug, e.g. 'stuttgart' (covers satellites)
   *  - CITY    → city slug (defaults to `citySlug` when omitted)
   */
  scopeRegion?: string | null;
  audiences?: ResourceAudience[];
  lifecycleStage?: ResourceStage[];
  priority?: number;
  isEssential?: boolean;
};

/* ────────────────────────────────────────────────────────────────────────
 *  Resource catalogue
 *
 *  Currently Stuttgart-scoped. As metros activate (Karlsruhe, Mannheim,
 *  Munich, Frankfurt) add city-specific resources here with `citySlug`.
 *  Pan-Germany resources (consular, tax, visa) intentionally attach to
 *  the launch city for now; introduce a nullable cityId later if needed.
 * ──────────────────────────────────────────────────────────────────────── */

export const RESOURCE_DEFS: ResourceEntry[] = [
  // ── Consular & Indian Government ──
  {
    title: 'CGI Munich — Consular Camp Stuttgart',
    slug: 'cgi-munich-consular-camp-stuttgart-2026',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in',
    description:
      'The Consulate General of India, Munich conducts periodic consular camps in Stuttgart for passport renewal, OCI card services, Police Clearance Certificates (PCC), and document attestation. Check the CGI Munich website for upcoming camp dates.',
  },
  {
    title: 'Passport Seva Portal — Renewal & New Applications',
    slug: 'passport-seva-renewal-india',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://passportindia.gov.in',
    description:
      'Official Government of India portal for passport applications and renewals. For Germany-based Indians, appointments are typically handled through CGI Munich or via the e-Passport portal.',
  },
  {
    title: 'VFS Global — Indian Visa & Passport Services Germany',
    slug: 'vfs-global-india-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'VISA_SERVICE',
    url: 'https://www.vfsglobal.com/India/Germany',
    description:
      'VFS Global is the authorised service provider for Indian passports and OCI card applications in Germany. Nearest VFS centres to Stuttgart are in Munich and Frankfurt. You can track your application status online.',
  },
  {
    title: 'OCI Card — Application & Renewal',
    slug: 'oci-card-application-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://ociservices.gov.in',
    description:
      'Overseas Citizenship of India (OCI) application portal. Required documents include German residence permit, current passport, Indian birth certificate, and photos. Apply online and submit at the nearest VFS centre.',
  },
  {
    title: 'Police Clearance Certificate (PCC) — Germany',
    slug: 'pcc-india-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in/pages/pcc',
    description:
      'Police Clearance Certificates (PCC) for Indians in Germany are issued by CGI Munich. Required for long-term visa applications, employment checks, and immigration. Applications can be submitted by post or at consular camps.',
  },
  {
    title: 'India House Stuttgart — Honorary Consulate',
    slug: 'india-house-stuttgart-honorary-consulate',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in',
    description:
      'Baden-Württemberg falls under the jurisdiction of the Consulate General of India, Munich. There is no full consulate in Stuttgart. For urgent assistance, contact CGI Munich directly.',
  },
  {
    title: 'Frankfurt Welcome & Information Center',
    slug: 'frankfurt-welcome-information-center',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://frankfurt-welcome-information-center.de/',
    citySlug: 'frankfurt',
    description:
      "Official city service from Frankfurt's Office for Multicultural Affairs (AmkA) for arrival guidance, orientation and referrals on residence, work, family, health and language support.",
  },
  {
    title: 'Frankfurt Service Portal — Bürgeramt & Online Appointments',
    slug: 'frankfurt-service-rathaus-portal',
    resourceType: 'CITY_REGISTRATION',
    url: 'https://frankfurt.de/service-und-rathaus/service',
    citySlug: 'frankfurt',
    description:
      'Official Frankfurt city portal for resident services, forms and appointment booking. Use this as the primary entry point for Anmeldung-related and other Bürgeramt procedures.',
  },
  {
    title: 'Frankfurt Immigration Office (Ausländerangelegenheiten)',
    slug: 'frankfurt-auslaenderangelegenheiten',
    resourceType: 'CITY_REGISTRATION',
    url: 'https://frankfurt.de/auslaenderangelegenheiten',
    citySlug: 'frankfurt',
    description:
      'Official Frankfurt immigration office information page for residence permits, visa extensions and related foreigner authority processes. Check current requirements before appointments.',
  },
  {
    title: 'CGI Munich — Republic Day & Independence Day Celebrations',
    slug: 'cgi-munich-national-day-celebrations',
    // folded from resource-classification
    scope: 'COUNTRY',
    consulate: 'munich',
    resourceType: 'OFFICIAL_EVENT',
    url: 'https://www.cgimunich.gov.in',
    description:
      'CGI Munich may publish official notices for national-day observances and other community-facing consular events. Always verify current dates, venue details and participation requirements on the official CGI Munich website.',
  },
  {
    title: 'MOIA — Ministry of Overseas Indian Affairs Resources',
    slug: 'moia-overseas-indian-resources',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://www.mea.gov.in/overseas-indian-affairs.htm',
    description:
      'Indian government portal for overseas Indians — scholarships, Pravasi Bharatiya Divas information, e-Migrate schemes, and diaspora support programs.',
  },

  // ── City Registration & Visa ──
  {
    title: 'Anmeldung — City Registration',
    slug: 'guide-anmeldung-stuttgart',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'Anmeldung (city registration) is mandatory after moving to Germany. You typically need identity documents, housing confirmation and appointment details from the city portal. Deadlines, required documents and processing times may change; always verify on the official city website.',
  },
  {
    title: 'Abmeldung — Deregistration When Leaving',
    slug: 'guide-abmeldung-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'When leaving Germany permanently, you may need to deregister with the city and keep the deregistration certificate for banks, insurance, tax filings and other closures. Deadlines and required documents vary by city; always verify on the official authority website.',
  },
  {
    title: 'Ausländerbehörde — Residence Permit & Visa Extension',
    slug: 'guide-auslaenderbehorde-stuttgart',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'The Ausländerbehörde handles residence permits, visa extensions and Blue Card matters. Appointment systems, office locations, document lists and processing times change often; always verify on the official city authority website before visiting.',
  },
  {
    title: 'EU Blue Card — For Skilled Workers',
    slug: 'guide-eu-blue-card',
    // folded from resource-classification
    scope: 'COUNTRY',
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card',
    description:
      'The EU Blue Card is a key residence route for qualified professionals in Germany. Eligibility depends on recognised qualifications, employment conditions and current salary thresholds. Thresholds and permanent-residence rules change; always verify on Make it in Germany or the responsible authority website.',
  },
  {
    title: 'Niederlassungserlaubnis — Permanent Residence',
    slug: 'guide-niederlassungserlaubnis-pr',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'Permanent residence (Niederlassungserlaubnis) may become available after meeting residence, contribution, income, language and other legal requirements. Rules differ by permit type and change over time; always verify on the official authority website before applying.',
  },
  {
    title: 'Verpflichtungserklärung — Invitation Letter for Visitors',
    slug: 'guide-verpflichtungserklaerung',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'To invite family for a visit, you may need a Verpflichtungserklärung from the responsible authority. Documents, fees and appointment rules vary by city and visa type; always verify on the official authority website and the relevant visa-service page.',
  },
  {
    title: 'Family Reunion Visa — Bringing Spouse & Children',
    slug: 'guide-family-reunion-visa',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'Spouses and children of residence-permit holders may apply for family reunion visas through the responsible German mission and local authority process. Document lists, language requirements and processing times change; always verify on official embassy and authority websites.',
  },
  {
    title: 'Marriage Registration — Indian Couples in Germany',
    slug: 'guide-marriage-registration-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'Marriage registration and recognition are handled by the Standesamt and may require apostilles, translations and consular documents. Requirements vary by city and personal situation; always verify with the Standesamt and the relevant consular authority.',
  },

  // ── Driving ──
  {
    title: 'Driving Licence Conversion — Indian to German',
    slug: 'guide-driving-licence-conversion',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'DRIVING',
    url: null,
    description:
      'Indian driving licences are generally not directly convertible in Germany, so theory and practical exams may be required. Validity periods, translation rules, required lessons and costs can change; always verify with the official driving-licence authority and your Fahrschule.',
  },
  {
    title: 'Finding an English-Speaking Fahrschule',
    slug: 'guide-fahrschule-english-stuttgart',
    resourceType: 'DRIVING',
    url: null,
    description:
      'Some Stuttgart-area Fahrschulen offer English-language support for theory or practical preparation. Availability, test language options and costs vary by school and authority; always confirm directly with the Fahrschule and official testing provider.',
  },
  {
    title: 'International Driving Permit (IDP)',
    slug: 'guide-international-driving-permit',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'DRIVING',
    url: null,
    description:
      'An International Driving Permit may be useful shortly after arrival, but recognition rules depend on licence type, residence status and local authority interpretation. Always verify validity, translation requirements and deadlines with the official driving-licence authority.',
  },

  // ── Grocery & Food ──
  {
    title: 'Finding Indian Groceries in Stuttgart',
    slug: 'guide-indian-groceries-stuttgart',
    resourceType: 'GROCERY_FOOD',
    url: null,
    description:
      'Stuttgart has several Indian and Asian grocery stores stocking spices, dals, rice (basmati, sona masoori), atta, frozen parathas, paneer, and fresh vegetables like curry leaves and green chillies. Key areas: Charlottenplatz, Bad Cannstatt, and Vaihingen. Ask in the "Indians in Stuttgart" WhatsApp group for current recommendations — stores change frequently. For specific South Indian items (urad dal, MTR mixes, coconut oil), check dedicated Indian stores over general Asian shops.',
  },
  {
    title: 'Indian Restaurants in Stuttgart',
    slug: 'guide-indian-restaurants-stuttgart',
    resourceType: 'GROCERY_FOOD',
    url: null,
    description:
      'Stuttgart has Indian restaurant options across several neighbourhoods, with vegetarian-friendly menus common. Restaurant quality, pricing and opening hours change frequently; verify current details through the restaurant website or a current map listing.',
  },
  {
    title: 'Online Indian Grocery Delivery — Germany-Wide',
    slug: 'guide-online-indian-grocery-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'GROCERY_FOOD',
    url: null,
    description:
      'Several online stores deliver Indian groceries across Germany and can be useful for bulk staples or hard-to-find regional ingredients. Delivery times, stock and prices change frequently; verify directly with the store before ordering.',
  },

  // ── Jobs & Careers ──
  {
    title: 'Job Portals for Internationals in Germany',
    slug: 'guide-job-portals-internationals',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'JOBS_CAREERS',
    url: null,
    description:
      'Key job portals: StepStone.de and Indeed.de (largest general boards), LinkedIn (strong for international roles), XING (German LinkedIn — important for local networking), Glassdoor.de (company reviews + jobs). For Stuttgart automotive: check career pages of Bosch, Mercedes-Benz, Porsche, ZF, Mahle, Continental directly. IT roles: check Stack Overflow Jobs and WeAreDevelopers. Agencies: Hays, Robert Half, Michael Page handle many Indian professional placements.',
  },
  {
    title: 'Freelance Visa — Self-Employment in Germany (§21 AufenthG)',
    slug: 'guide-freelance-visa-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'JOBS_CAREERS',
    url: null,
    description:
      'The freelance visa can allow non-EU citizens to work independently in Germany when legal and business requirements are met. Required documents, financial evidence and processing times vary by authority; always verify on the official immigration authority website.',
  },
  {
    title: 'Agentur für Arbeit — Job Search & Unemployment Benefits',
    slug: 'guide-agentur-fuer-arbeit',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.arbeitsagentur.de/',
    description:
      'The Agentur für Arbeit offers job placement, career counselling and unemployment-benefit information. Benefit eligibility, deadlines and residence-permit implications depend on individual circumstances; always verify with the Agentur für Arbeit and the responsible immigration authority.',
  },

  // ── Tax & Finance ──
  {
    title: 'Annual Tax Declaration (Steuererklärung)',
    slug: 'guide-steuererklaerung-basics',
    // folded from resource-classification
    scope: 'COUNTRY',
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de',
    description:
      'Many residents file an annual German tax return through ELSTER, tax software or a Steuerberater. Deductible categories and deadlines change and depend on individual circumstances; always verify on ELSTER or with a qualified tax advisor.',
  },
  {
    title: 'India-Germany DTAA — Double Taxation Avoidance',
    slug: 'guide-dtaa-india-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      'The India-Germany Double Taxation Avoidance Agreement (DTAA) prevents you from being taxed twice on the same income. Key points: (1) Salary earned in Germany is taxed only in Germany, (2) Indian rental income: taxed in India, but you get a credit in Germany, (3) RSUs/ESOPs: complex — usually taxed in both, credit applies, (4) NRE account interest: tax-free in India, must be declared in Germany, (5) Capital gains on Indian mutual funds: declare in German return. A Steuerberater who understands DTAA is essential — not all do.',
  },
  {
    title: 'NRE & NRO Accounts — Managing Indian Finances from Germany',
    slug: 'guide-nre-nro-accounts',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      'As an NRI (Non-Resident Indian), you must convert your Indian savings accounts to NRE (Non-Resident External) or NRO (Non-Resident Ordinary). NRE: for parking foreign earnings in India — interest is tax-free in India, fully repatriable. NRO: for Indian-sourced income (rent, dividends) — taxed in India, limited repatriation ($1M/year). Notify your Indian bank within a reasonable time of moving abroad. Keep both types for flexibility.',
  },
  {
    title: 'ELSTER — Online Tax Filing Portal',
    slug: 'guide-elster-tax-portal',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de',
    description:
      'ELSTER is the official German online tax portal for tax returns and related tax services. Registration, activation and available forms can change; always verify the current process on ELSTER.',
  },
  {
    title: 'Finding an English-Speaking Steuerberater',
    slug: 'guide-steuerberater-english',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      'A Steuerberater can help with complex tax situations such as DTAA, equity compensation, foreign accounts or self-employment. Fees, deadlines and software options vary; verify directly with the advisor, tax software provider or official tax portal.',
  },

  // ── Business Setup ──
  {
    title: 'Freiberufler vs Gewerbe — Understanding the Difference',
    slug: 'guide-freiberufler-vs-gewerbe',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      "Germany distinguishes between Freiberufler (freelancers in regulated professions: IT consultants, engineers, doctors, teachers, artists) and Gewerbetreibende (tradespeople running a Gewerbe: shops, agencies, most online businesses). Key difference: Freiberufler don't pay Gewerbesteuer (trade tax) and have simpler bookkeeping. Your Finanzamt decides your classification. If you're an IT consultant from India — you're likely Freiberufler. If you open a restaurant — that's Gewerbe.",
  },
  {
    title: 'Gewerbeanmeldung — Trade Licence Registration',
    slug: 'guide-gewerbeanmeldung',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      'If you start a Gewerbe, registration is handled by the responsible Gewerbeamt and may also trigger tax and chamber-of-commerce steps. Fees, forms and follow-up obligations vary by city and business type; always verify on the official authority website.',
  },
  {
    title: 'Fragebogen zur steuerlichen Erfassung — Finanzamt Registration',
    slug: 'guide-fragebogen-steuerliche-erfassung',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      'New businesses usually need to register tax details with the Finanzamt through ELSTER. VAT status, small-business rules and processing times depend on current law and your business setup; always verify on ELSTER or with a qualified tax advisor.',
  },

  // ── Family & Children ──
  {
    title: 'Kindergeld — Child Benefit for Non-EU Families',
    slug: 'guide-kindergeld-non-eu',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://familienportal.de/familienportal/familienleistungen/kindergeld',
    description:
      'Kindergeld is a German child-benefit process handled through the Familienkasse. Eligibility, amounts, required documents and retrospective-claim rules change; always verify on Familienportal and the Familienkasse website.',
  },
  {
    title: 'Elterngeld — Parental Allowance',
    slug: 'guide-elterngeld-parental-allowance',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://familienportal.de/familienportal/familienleistungen/elterngeld',
    description:
      'Elterngeld and ElterngeldPlus support parents after a child is born and are handled by the responsible state authority. Amounts, eligibility, document lists and deadlines change; always verify on Familienportal and the responsible state website.',
  },
  {
    title: 'Mutterschutz & Elternzeit — Maternity Leave & Parental Leave',
    slug: 'guide-mutterschutz-elternzeit',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'FAMILY_CHILDREN',
    url: null,
    description:
      'Mutterschutz and Elternzeit provide maternity and parental-leave protections in Germany. Notice periods, working-hour limits and eligibility details can change; always verify on official family-policy resources or with your employer/HR team.',
  },
  {
    title: 'Kita & Kindergarten Search — Stuttgart',
    slug: 'guide-kita-kindergarten-stuttgart',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://www.stuttgart.de/leben/bildung/kitas/',
    description:
      'Use the Stuttgart Kita finder to search and apply for childcare places. Availability, fees, age groups and application timelines change frequently; always verify directly in the official portal and with the childcare provider.',
  },
  {
    title: 'School Enrollment — For Indian Families',
    slug: 'guide-school-enrollment-stuttgart',
    resourceType: 'FAMILY_CHILDREN',
    url: null,
    description:
      "School enrollment depends on state and local rules, assigned school districts and the child's language needs. Required documents, vaccination rules and support classes may change; always verify with the school office or official education authority.",
  },

  // ── Health & Doctors ──
  {
    title: 'Health Insurance — GKV vs PKV',
    slug: 'guide-health-insurance-gkv-pkv',
    // folded from resource-classification
    scope: 'COUNTRY',
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'HEALTH_DOCTORS',
    url: null,
    description:
      'Health insurance is mandatory in Germany, usually through public or private insurance depending on employment, income and personal situation. Contribution rates and eligibility thresholds change; always verify with official health-insurance guidance or the insurer.',
  },
  {
    title: 'Finding a Hausarzt (Family Doctor) in Stuttgart',
    slug: 'guide-finding-hausarzt-stuttgart',
    resourceType: 'HEALTH_DOCTORS',
    url: null,
    description:
      "Register with a Hausarzt (GP/family doctor) as soon as you arrive — they're your gateway to the German healthcare system and provide referrals to specialists. Use jameda.de or doctolib.de to search by language (English or Hindi). Many doctors in Stuttgart accept new patients but may have waitlists. Bring your Versichertenkarte (insurance card) from your Krankenkasse. For Hindi/Tamil/Telugu-speaking doctors, ask in community WhatsApp groups.",
  },
  {
    title: 'Emergency Numbers & Hospitals',
    slug: 'guide-emergency-numbers-germany',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'HEALTH_DOCTORS',
    url: null,
    description:
      'Germany has national emergency and non-emergency medical numbers, and cities publish current hospital and pharmacy emergency-service information. Always verify current emergency-care locations and pharmacy duty schedules through official services.',
  },

  // ── Housing ──
  {
    title: 'Apartment Search in Stuttgart',
    slug: 'guide-apartment-search-stuttgart',
    resourceType: 'HOUSING',
    url: null,
    description:
      'Stuttgart has a competitive housing market. Use established apartment, WG and temporary-housing portals, and always get the documents needed for Anmeldung from your landlord. Rent levels, deposits and portal availability change; verify current listings and tenancy rules.',
  },
  {
    title: 'Schufa — Credit Score in Germany',
    slug: 'guide-schufa-credit-score',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'HOUSING',
    url: 'https://www.schufa.de',
    description:
      "Schufa is Germany's credit reporting agency, and landlords or banks may ask for a credit report. Report options, fees and delivery times can change; always verify directly on the official Schufa website.",
  },
  {
    title: 'GEZ / Rundfunkbeitrag — TV & Radio License Fee',
    slug: 'guide-gez-rundfunkbeitrag',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'HOUSING',
    url: 'https://www.rundfunkbeitrag.de',
    description:
      "The Rundfunkbeitrag is Germany's household broadcasting contribution. Amounts, exemption rules and registration processes can change; always verify directly on the official Rundfunkbeitrag website.",
  },

  /* ──────────────────────────────────────────────────────────────────────
   *  BERLIN
   * ────────────────────────────────────────────────────────────────────── */
  {
    title: 'Embassy of India, Berlin — Consular Services',
    slug: 'embassy-india-berlin-consular',
    // folded from resource-classification
    scope: 'COUNTRY',
    consulate: 'berlin',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://indianembassyberlin.gov.in',
    description:
      'The Embassy of India in Berlin is the primary consular post for Berlin, Brandenburg and the surrounding region. Services include passport renewal, OCI card, visa, attestation and PCC. Check the embassy website for appointment booking and current service hours.',
    citySlug: 'berlin',
  },
  {
    title: 'Anmeldung in Berlin — Bürgeramt Registration',
    slug: 'guide-anmeldung-berlin',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://service.berlin.de/dienstleistung/120335/',
    description:
      'You must register your address (Anmeldung) at a Berlin Bürgeramt within 14 days of moving in. Bring your passport, signed Wohnungsgeberbestätigung from your landlord and the completed Anmeldeformular. Berlin Bürgeramt appointments are notoriously hard to get — book early via the service portal or accept any available slot citywide.',
    citySlug: 'berlin',
  },
  {
    title: 'Berlin Bürgeramt — Find a Location & Book Appointment',
    slug: 'berlin-buergeramt-locations',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://service.berlin.de/standorte/buergeraemter/',
    description:
      'Berlin has dozens of Bürgerämter across all 12 districts. Any Bürgeramt can perform Anmeldung — you are not bound to your district. Use the official service portal to compare available appointment slots citywide; new slots are typically released on weekday mornings.',
    citySlug: 'berlin',
  },
  {
    title: 'Berlin Willkommenszentrum — Welcome Center for New Berliners',
    slug: 'berlin-welcome-center',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://www.berlin.de/willkommenszentrum/',
    description:
      'The Berlin Willkommenszentrum offers free orientation for international newcomers: residence permits, recognition of qualifications, language courses, schooling and integration support. Walk-in and appointment consultations are available in English and several other languages.',
    citySlug: 'berlin',
  },
  {
    title: 'Berlin Ausländerbehörde (LEA) — Residence Permit Appointment',
    slug: 'berlin-lea-residence-permit',
    resourceType: 'CITY_REGISTRATION',
    url: 'https://service.berlin.de/dienstleistung/324269/',
    description:
      "Berlin's Landesamt für Einwanderung (LEA) handles residence permits, Blue Card, settlement permits and family reunification. Book appointments online — most categories are appointment-only. For urgent extensions you can submit a Fiktionsbescheinigung request before your current permit expires.",
    citySlug: 'berlin',
  },
  {
    title: 'Kindertagesbetreuung Berlin — Kita Registration',
    slug: 'guide-kita-berlin',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://www.berlin.de/sen/jugend/familie-und-kinder/kindertagesbetreuung/',
    description:
      'Berlin children aged 1+ have a legal right to a Kita place. Apply for the Kita-Gutschein (voucher) at your district Jugendamt 9 months before you need a place, then approach Kitas directly. Kita fees are waived in Berlin; you only pay for meals.',
    citySlug: 'berlin',
  },
  {
    title: 'IHK Berlin — Business Registration & Self-Employment',
    slug: 'ihk-berlin-business',
    resourceType: 'BUSINESS_SETUP',
    url: 'https://www.ihk-berlin.de/',
    description:
      'The Chamber of Commerce and Industry (IHK) Berlin is the first stop for founders and freelancers: Gewerbeanmeldung guidance, freelancer recognition (Freiberufler vs Gewerbe), tax basics and free founder consultations in English.',
    citySlug: 'berlin',
  },
  {
    title: 'Bundesagentur für Arbeit — Jobs & Career Counselling',
    slug: 'arbeitsagentur-berlin',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.arbeitsagentur.de/',
    description:
      'The Federal Employment Agency offers free job listings, career counselling and integration support for newcomers. Berlin offices provide consultations in English; the Make-it-in-Germany portal links into the same database for skilled-worker placements.',
    citySlug: 'berlin',
  },

  /* ──────────────────────────────────────────────────────────────────────
   *  MUNICH
   * ────────────────────────────────────────────────────────────────────── */
  {
    title: 'CGI Munich — Consulate General of India',
    slug: 'cgi-munich-consular-services',
    // folded from resource-classification
    scope: 'COUNTRY',
    consulate: 'munich',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in',
    description:
      'The Consulate General of India in Munich serves Bavaria, Baden-Württemberg, Hesse, Rheinland-Pfalz, Saarland and Baden. Services include passport, OCI, visa, attestation and PCC. Many services run via VFS Global; check the CGI Munich website for the latest appointment process.',
    citySlug: 'munich',
  },
  {
    title: 'Bürgerbüro München — Anmeldung & City Registration',
    slug: 'buergerbuero-munich',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://stadt.muenchen.de/infos/buergerbuero.html',
    description:
      'Munich Bürgerbüros handle Anmeldung, Ummeldung, ID cards and many everyday civic services. Online appointments are mandatory for most services — book via the official stadt.muenchen.de portal. Bring passport, Wohnungsgeberbestätigung and a completed Meldeschein.',
    citySlug: 'munich',
  },
  {
    title: 'Ausländerbehörde KVR München — Residence Permits',
    slug: 'auslaenderbehoerde-munich',
    resourceType: 'CITY_REGISTRATION',
    url: 'https://stadt.muenchen.de/infos/auslaenderbehoerde.html',
    description:
      "Munich's Ausländerbehörde sits inside the Kreisverwaltungsreferat (KVR). It issues Aufenthaltstitel, Blue Card, settlement permits and family reunification. All categories are appointment-only — book online well in advance; popular Blue Card slots can be weeks out.",
    citySlug: 'munich',
  },
  {
    title: 'Kinderbetreuung München — Kita & Krippe Information',
    slug: 'guide-kita-munich',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://stadt.muenchen.de/infos/kinderbetreuung.html',
    description:
      'Munich offers Krippe (under 3), Kindergarten (3–6) and Hort (school-age) places. Apply via kita-finder.muenchen.de; demand is very high so apply 6–12 months ahead. Municipal Kita fees are heavily subsidised since 2020.',
    citySlug: 'munich',
  },
  {
    title: 'IHK München & Oberbayern — Business Setup',
    slug: 'ihk-munich-business',
    resourceType: 'BUSINESS_SETUP',
    url: 'https://www.ihk-muenchen.de/',
    description:
      'IHK München und Oberbayern supports founders and freelancers with free start-up consultations, Gewerbeanmeldung guidance and qualification recognition. Several services are offered in English for international founders.',
    citySlug: 'munich',
  },
  {
    title: 'Invest in Bavaria — English Resources for Newcomers',
    slug: 'invest-in-bavaria-newcomers',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.invest-in-bavaria.com/en',
    description:
      'Invest in Bavaria is the official Bavarian state agency for business and talent. The English portal lists open jobs, sector guides, work-permit basics and direct contacts for skilled-worker support — useful for newcomers to Munich, Nuremberg and Augsburg.',
    citySlug: 'munich',
  },
  {
    title: '116117 — Doctor-on-duty service (Germany-wide)',
    slug: 'guide-116117-doctor-on-duty-munich',
    // folded from resource-classification
    scope: 'COUNTRY',
    resourceType: 'HEALTH_DOCTORS',
    url: 'https://www.116117.de/',
    description:
      'Call 116117 anywhere in Germany for non-emergency medical care, including evenings, weekends and public holidays. For life-threatening emergencies always call 112.',
  },
  {
    title: 'ELSTER — Online Tax Filing',
    slug: 'elster-munich',
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de/',
    description:
      "ELSTER is Germany's official online tax portal. Register early — activation requires a postal code sent to your registered address (can take 2 weeks). Once registered you can file Einkommensteuererklärung and Umsatzsteuer returns yourself or grant access to your Steuerberater.",
    citySlug: 'munich',
  },

  /* ──────────────────────────────────────────────────────────────────────
   *  FRANKFURT (additions to existing 3)
   * ────────────────────────────────────────────────────────────────────── */
  {
    title: 'CGI Frankfurt — Consulate General of India',
    slug: 'cgi-frankfurt-consular-services',
    // folded from resource-classification
    scope: 'COUNTRY',
    consulate: 'frankfurt',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://cgifrankfurt.gov.in/',
    description:
      'The Consulate General of India in Frankfurt serves Hesse, Nordrhein-Westfalen, Saarland, Rheinland-Pfalz, Thüringen and Sachsen. Services include passport, OCI, visa, attestation and PCC. Many services are routed through VFS Global; verify the latest process on the official CGI Frankfurt website.',
    citySlug: 'frankfurt',
  },
  {
    title: 'Frankfurt am Main — City Portal & Bürgerservice',
    slug: 'frankfurt-buergerservice',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://frankfurt.de/',
    description:
      "Frankfurt's official city portal hosts the Bürgerämter directory, Anmeldung instructions, Ausländerbehörde information and all everyday municipal services. Bürgeramt appointments must be booked online; bring passport and Wohnungsgeberbestätigung.",
    citySlug: 'frankfurt',
  },
  {
    title: 'IHK Frankfurt am Main — Business Setup',
    slug: 'ihk-frankfurt-business',
    resourceType: 'BUSINESS_SETUP',
    url: 'https://www.frankfurt-main.ihk.de/',
    description:
      'IHK Frankfurt am Main supports new founders and freelancers in the Rhein-Main region: Gewerbeanmeldung guidance, English-language start-up consultations and qualification recognition for non-EU professionals.',
    citySlug: 'frankfurt',
  },
  {
    title: 'Frankfurt Business — Investment & Skilled Workers',
    slug: 'frankfurt-business-newcomers',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.frankfurt-business.net/',
    description:
      'Frankfurt Business is the official economic development arm of the city. The portal lists employer directories, sector reports and integration resources for international skilled workers moving to the Rhein-Main metro.',
    citySlug: 'frankfurt',
  },
  {
    title: '116117 — Doctor on Duty (Hesse-wide)',
    slug: 'guide-116117-doctor-on-duty-frankfurt',
    resourceType: 'HEALTH_DOCTORS',
    url: 'https://www.116117.de/',
    description:
      'Call 116117 for non-emergency medical care across Hesse and the rest of Germany — including evenings, weekends and holidays. The site lists nearby Bereitschaftspraxen and on-duty doctors. For life-threatening emergencies call 112.',
    citySlug: 'frankfurt',
  },

  /* ──────────────────────────────────────────────────────────────────────
   *  KARLSRUHE
   * ────────────────────────────────────────────────────────────────────── */
  {
    title: 'CGI Munich — Consular Services for Baden-Württemberg',
    slug: 'cgi-munich-consular-karlsruhe',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in',
    description:
      'The Consulate General of India in Munich is the responsible consular post for Karlsruhe and all of Baden-Württemberg. Periodic consular camps are held in Stuttgart and occasionally elsewhere in BW; check the CGI Munich website for upcoming dates.',
    citySlug: 'karlsruhe',
  },
  {
    title: 'Karlsruhe — City Portal & Bürgerservice',
    slug: 'karlsruhe-buergerservice',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://www.karlsruhe.de/',
    description:
      'The official Karlsruhe city portal hosts the Bürgerbüro directory, Anmeldung instructions, Ausländerbehörde information and family services. Most Bürgerbüro services require an online appointment.',
    citySlug: 'karlsruhe',
  },
  {
    title: 'IHK Karlsruhe — Business & Freelancer Support',
    slug: 'ihk-karlsruhe-business',
    resourceType: 'BUSINESS_SETUP',
    url: 'https://www.karlsruhe.ihk.de/',
    description:
      'IHK Karlsruhe supports founders and freelancers in TechnologieRegion Karlsruhe with free start-up consultations, Gewerbeanmeldung guidance and qualification recognition.',
    citySlug: 'karlsruhe',
  },
  {
    title: 'Bundesagentur für Arbeit — Karlsruhe Jobs & Counselling',
    slug: 'arbeitsagentur-karlsruhe',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.arbeitsagentur.de/',
    description:
      'The Federal Employment Agency offers free job listings, career counselling and skilled-worker integration support. The Karlsruhe office covers the wider TechnologieRegion including Bruchsal and Bretten.',
    citySlug: 'karlsruhe',
  },
  {
    title: 'ELSTER — Online Tax Filing (Karlsruhe)',
    slug: 'elster-karlsruhe',
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de/',
    description:
      "ELSTER is Germany's official online tax portal. Register early — activation requires a postal code sent to your registered Karlsruhe address (can take 2 weeks). Once registered you can file your Einkommensteuererklärung yourself or grant access to your Steuerberater.",
    citySlug: 'karlsruhe',
  },
  {
    title: '116117 — Doctor on Duty (Karlsruhe & BW)',
    slug: 'guide-116117-doctor-on-duty-karlsruhe',
    resourceType: 'HEALTH_DOCTORS',
    url: 'https://www.116117.de/',
    description:
      'Call 116117 for non-emergency medical care in Karlsruhe and across Baden-Württemberg, including evenings, weekends and holidays. The site lists nearby Bereitschaftspraxen and on-duty doctors. For life-threatening emergencies call 112.',
    citySlug: 'karlsruhe',
  },

  /* ──────────────────────────────────────────────────────────────────────
   *  MANNHEIM
   * ────────────────────────────────────────────────────────────────────── */
  {
    title: 'CGI Munich — Consular Services for Rhein-Neckar',
    slug: 'cgi-munich-consular-mannheim',
    resourceType: 'CONSULAR_SERVICE',
    url: 'https://www.cgimunich.gov.in',
    description:
      'The Consulate General of India in Munich is the responsible consular post for Mannheim and the Rhein-Neckar region in Baden-Württemberg. CGI Frankfurt is closer but only covers Hesse and surrounding states; for Mannheim residents, Munich is the right consulate.',
    citySlug: 'mannheim',
  },
  {
    title: 'Mannheim Bürgerdienste — Anmeldung & City Services',
    slug: 'mannheim-buergerdienste',
    // folded from resource-classification
    isEssential: true,
    priority: 80,
    lifecycleStage: ['FIRST_30_DAYS'],
    resourceType: 'CITY_REGISTRATION',
    url: 'https://www.mannheim.de/de/service-bieten/buergerdienste',
    description:
      'The Mannheim Bürgerdienste portal covers Anmeldung, Ummeldung, ID cards, residence permits and Ausländerbehörde appointments. Most services are appointment-only — book online via the official mannheim.de portal.',
    citySlug: 'mannheim',
  },
  {
    title: 'Kinderbetreuung Mannheim — Kita Information',
    slug: 'guide-kita-mannheim',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://www.mannheim.de/de/bildung-staerken/kinderbetreuung',
    description:
      'Mannheim offers Kita, Krippe and Tagespflege places via the city Jugendamt. Apply through the city Kita-Portal as early as possible — popular Kitas in central Mannheim have long waitlists. Income-based fee waivers are available.',
    citySlug: 'mannheim',
  },
  {
    title: 'IHK Rhein-Neckar — Business & Freelancer Support',
    slug: 'ihk-rhein-neckar-business',
    resourceType: 'BUSINESS_SETUP',
    url: 'https://www.rhein-neckar.ihk24.de/',
    description:
      'IHK Rhein-Neckar covers Mannheim, Heidelberg and the wider Rhein-Neckar metro. Services include free start-up consultations, Gewerbeanmeldung guidance and qualification recognition for skilled workers from non-EU countries.',
    citySlug: 'mannheim',
  },
  {
    title: 'Bundesagentur für Arbeit — Mannheim Jobs & Counselling',
    slug: 'arbeitsagentur-mannheim',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.arbeitsagentur.de/',
    description:
      'The Federal Employment Agency Mannheim branch covers the Rhein-Neckar metro and offers free job listings, career counselling and integration support for international skilled workers.',
    citySlug: 'mannheim',
  },
  {
    title: '116117 — Doctor on Duty (Mannheim & Rhein-Neckar)',
    slug: 'guide-116117-doctor-on-duty-mannheim',
    resourceType: 'HEALTH_DOCTORS',
    url: 'https://www.116117.de/',
    description:
      'Call 116117 for non-emergency medical care in Mannheim, Heidelberg and across the Rhein-Neckar region, including evenings, weekends and holidays. For life-threatening emergencies call 112.',
    citySlug: 'mannheim',
  },
];

/* ────────────────────────────────────────────────────────────────────────
 *  Reconciler
 * ──────────────────────────────────────────────────────────────────────── */

export type ResourcesResult = {
  created: number;
  skippedExisting: number;
  skippedMissingCity: number;
  skippedInvalid: number;
  skippedDuplicate: number;
};

function evidenceUrlsFor(entry: ResourceEntry): string[] {
  return [
    entry.url,
    ...(entry.evidenceUrls ?? []),
    ...(RESOURCE_TYPE_EVIDENCE_URLS[entry.resourceType] ?? []),
  ].filter((url): url is string => Boolean(url));
}

export async function runResourcesSeed(): Promise<ResourcesResult> {
  const result: ResourcesResult = {
    created: 0,
    skippedExisting: 0,
    skippedMissingCity: 0,
    skippedInvalid: 0,
    skippedDuplicate: 0,
  };

  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityIdBySlug = new Map(cities.map((c) => [c.slug, c.id]));

  for (const entry of RESOURCE_DEFS) {
    // PRD/TDD-0030 — duplicates are pruned at the source. The canonical
    // COUNTRY-scoped row supersedes each city-fanout copy; see
    // `prisma/resource-classification.ts`.
    if (DUPLICATE_SLUG_SET.has(entry.slug)) {
      result.skippedDuplicate++;
      continue;
    }

    const evidenceUrls = evidenceUrlsFor(entry);
    const qualifyingEvidence = getQualifyingEvidence(evidenceUrls);
    if (qualifyingEvidence.length === 0) {
      const firstAssessment = evidenceUrls[0] ? assessEvidenceUrl(evidenceUrls[0]) : null;
      console.warn(
        `  ⚠ ${entry.slug}: missing qualifying resource evidence${firstAssessment ? ` (${firstAssessment.label})` : ''} — skipped`,
      );
      result.skippedInvalid++;
      continue;
    }

    // PRD/TDD-0030 — scope/consulate/essential are now authored inline on
    // each entry (see ResourceEntry). Default to CITY when unspecified.
    const scope: ResourceScope = entry.scope ?? 'CITY';

    // CITY/METRO rows need a city slug to derive the cityId; COUNTRY/STATE/
    // GLOBAL rows do not.
    const citySlug = entry.citySlug ?? 'stuttgart';
    const needsCityId = scope === 'CITY';
    const cityId = cityIdBySlug.get(citySlug);
    if (needsCityId && !cityId) {
      console.warn(`  ⚠ ${entry.slug}: city "${citySlug}" not found (run bootstrap?) — skipped`);
      result.skippedMissingCity++;
      continue;
    }

    const scopeRegion =
      entry.scopeRegion !== undefined
        ? entry.scopeRegion
        : scope === 'GLOBAL'
          ? null
          : scope === 'COUNTRY'
            ? 'DE'
            : scope === 'CITY' || scope === 'METRO'
              ? citySlug
              : null;
    // cityId remains set for CITY scope (back-compat with code still reading
    // `Resource.cityId`); Phase B will drop the column entirely.
    const cityIdForRow = scope === 'CITY' ? (cityId ?? null) : null;

    const existing = await prisma.resource.findUnique({
      where: { slug: entry.slug },
      select: { id: true },
    });
    if (existing) {
      result.skippedExisting++;
      continue;
    }

    const title = entry.title;
    const description = entry.description;
    const isEssential = entry.isEssential ?? false;
    const priority = entry.priority ?? (isEssential ? 80 : 50);
    const consulate = entry.consulate;

    try {
      const baseMetadata: Prisma.JsonObject = {
        editorialSource: 'resources-seed',
        sourceEvidence: qualifyingEvidence.map((evidence) => ({
          url: evidence.normalizedUrl,
          tier: evidence.tier,
          label: evidence.label,
          requiresReview: evidence.requiresReview,
        })),
        seededAt: new Date().toISOString(),
        lastReviewedAt: (entry.lastReviewedAt ?? SEED_REVIEWED_AT).toISOString(),
        reviewCadenceDays: entry.reviewCadenceDays ?? DEFAULT_REVIEW_CADENCE_DAYS,
      };
      if (consulate) baseMetadata.consulate = consulate;

      await prisma.resource.create({
        data: {
          title,
          slug: entry.slug,
          resourceType: entry.resourceType,
          url: entry.url,
          description,
          validFrom: entry.validFrom ?? null,
          validUntil: entry.validUntil ?? null,
          isHidden: false,
          hiddenReason: null,
          lastReviewedAt: entry.lastReviewedAt ?? SEED_REVIEWED_AT,
          reviewCadenceDays: entry.reviewCadenceDays ?? DEFAULT_REVIEW_CADENCE_DAYS,
          cityId: cityIdForRow,
          scope,
          scopeRegion,
          audiences: entry.audiences ?? [],
          lifecycleStage: entry.lifecycleStage ?? [],
          priority,
          isEssential,
          source: 'ADMIN_SEED',
          metadata: baseMetadata,
        },
      });
      result.created++;
    } catch (err) {
      console.error(`  ❌ Failed to seed resource ${entry.slug}:`, err);
    }
  }

  return result;
}

async function main() {
  console.log('📚 IndLokal resources seed — curated public knowledge\n');
  const started = Date.now();
  const r = await runResourcesSeed();
  const ms = Date.now() - started;
  console.log(`\n✅ Resources seed complete in ${ms}ms`);
  console.log(`   created ${r.created}, skipped ${r.skippedExisting} (already present)`);
  if (r.skippedDuplicate > 0) {
    console.log(`   ⊘ ${r.skippedDuplicate} skipped as known duplicates (PRD/TDD-0030)`);
  }
  if (r.skippedMissingCity > 0) {
    console.log(`   ⚠ ${r.skippedMissingCity} skipped because city was missing`);
  }
  if (r.skippedInvalid > 0) {
    console.log(`   ⚠ ${r.skippedInvalid} skipped because source evidence was missing/weak`);
  }
}

const isDirectRun =
  typeof require !== 'undefined' && require.main === module
    ? true
    : process.argv[1]?.endsWith('resources.ts') || process.argv[1]?.endsWith('resources.js');

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('❌ Resources seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
