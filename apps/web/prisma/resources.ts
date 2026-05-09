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
 * 2. Either a public `url` (official source) OR a self-authored guide
 *    summarising public process facts. Never republish copyrighted prose
 *    without attribution.
 * 3. Idempotent and create-only. Existing rows are NEVER updated by this
 *    script — admin edits must survive every redeploy.
 * 4. No personal data. No event dates that go stale.
 * 5. When facts change (fees, deadlines, addresses), update via the admin
 *    UI in prod or fix here and bump the slug — do NOT silently rewrite
 *    existing rows.
 *
 * Run manually:   pnpm --filter web db:resources
 * Run on deploy:  invoked transitively by runDirectorySeed().
 */

import { PrismaClient, type ResourceType } from '@prisma/client';

const prisma = new PrismaClient();

export type ResourceEntry = {
  title: string;
  slug: string;
  resourceType: ResourceType;
  /** Official source URL, or null for self-authored process guides. */
  url: string | null;
  description: string;
  /** Optional city slug to scope the resource. Defaults to Stuttgart for now. */
  citySlug?: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
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
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://passportindia.gov.in',
    description:
      'Official Government of India portal for passport applications and renewals. For Germany-based Indians, appointments are typically handled through CGI Munich or via the e-Passport portal.',
  },
  {
    title: 'VFS Global — Indian Visa & Passport Services Germany',
    slug: 'vfs-global-india-germany',
    resourceType: 'VISA_SERVICE',
    url: 'https://www.vfsglobal.com/India/Germany',
    description:
      'VFS Global is the authorised service provider for Indian passports and OCI card applications in Germany. Nearest VFS centres to Stuttgart are in Munich and Frankfurt. You can track your application status online.',
  },
  {
    title: 'OCI Card — Application & Renewal',
    slug: 'oci-card-application-germany',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://ociservices.gov.in',
    description:
      'Overseas Citizenship of India (OCI) application portal. Required documents include German residence permit, current passport, Indian birth certificate, and photos. Apply online and submit at the nearest VFS centre.',
  },
  {
    title: 'Police Clearance Certificate (PCC) — Germany',
    slug: 'pcc-india-germany',
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
    title: 'CGI Munich — Republic Day & Independence Day Celebrations',
    slug: 'cgi-munich-cultural-night-2026',
    resourceType: 'OFFICIAL_EVENT',
    url: 'https://www.cgimunich.gov.in',
    description:
      'CGI Munich organises Republic Day (26 Jan) and Independence Day (15 Aug) flag-hoisting ceremonies at the Consulate. Special charter buses are often arranged from Stuttgart by community groups like HSS Stuttgart.',
  },
  {
    title: 'MOIA — Ministry of Overseas Indian Affairs Resources',
    slug: 'moia-overseas-indian-resources',
    resourceType: 'GOVERNMENT_INFO',
    url: 'https://www.mea.gov.in/overseas-indian-affairs.htm',
    description:
      'Indian government portal for overseas Indians — scholarships, Pravasi Bharatiya Divas information, e-Migrate schemes, and diaspora support programs.',
  },

  // ── City Registration & Visa ──
  {
    title: 'Anmeldung — City Registration',
    slug: 'guide-anmeldung-stuttgart',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      "Anmeldung (city registration) is mandatory within 14 days of moving to Stuttgart. You need: passport, rental contract, and Wohnungsgeberbestätigung (landlord confirmation form). Register at any Bürgerbüro — Mitte is the largest. Book online or walk in. You'll receive a Meldebescheinigung (registration certificate) and your Steuer-ID (tax ID) arrives by post in 2-3 weeks.",
  },
  {
    title: 'Abmeldung — Deregistration When Leaving',
    slug: 'guide-abmeldung-germany',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      "When leaving Germany permanently, you must deregister (Abmeldung) at any Bürgerbüro up to 14 days before departure. You need: passport, Meldebescheinigung, and the Abmeldung form. Also notify your bank, health insurance (Krankenkasse), employer, and cancel your GEZ (Rundfunkbeitrag). Keep the Abmeldebescheinigung — you'll need it for tax filings and closing accounts.",
  },
  {
    title: 'Ausländerbehörde — Residence Permit & Visa Extension',
    slug: 'guide-auslaenderbehorde-stuttgart',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      "The Ausländerbehörde (foreigners' registration office) in Stuttgart handles residence permits, visa extensions, and Blue Card issuance. Located at Eberhardstr. 39. Book appointments via the online portal — walk-ins have long waits. Bring: passport, biometric photo, employment contract, health insurance proof, Meldebescheinigung, and previous visa. Processing takes 4-8 weeks.",
  },
  {
    title: 'EU Blue Card — For Skilled Workers',
    slug: 'guide-eu-blue-card',
    resourceType: 'CITY_REGISTRATION',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card',
    description:
      'The EU Blue Card is the main residence permit for qualified Indian professionals in Germany. Requirements: a recognised university degree and a job offer with a minimum annual salary of €45,300 (2024, or €41,042 for shortage occupations like IT and engineering). Apply at the German embassy in India before arrival, or convert from a job-seeker visa at the Ausländerbehörde after arrival. Blue Card holders can apply for permanent residence (Niederlassungserlaubnis) after 21 months with B1 German.',
  },
  {
    title: 'Niederlassungserlaubnis — Permanent Residence',
    slug: 'guide-niederlassungserlaubnis-pr',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'Permanent residence (Niederlassungserlaubnis) is the holy grail for long-term stay. Blue Card holders: eligible after 21 months (with B1 German) or 33 months (with A1). Requirements: 21+ months of Blue Card, pension contributions for the same period, B1 German certificate (Goethe/telc), valid health insurance, sufficient income, no criminal record. Apply at the Ausländerbehörde with all supporting documents.',
  },
  {
    title: 'Verpflichtungserklärung — Invitation Letter for Visitors',
    slug: 'guide-verpflichtungserklaerung',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      "To invite family from India for a visit, you may need a Verpflichtungserklärung (formal obligation letter) from the Ausländerbehörde. This guarantees you'll cover their expenses during the stay. Requirements: your passport, Meldebescheinigung, last 3 salary slips, employment contract. Fee: ~€29. The original is sent to your family member who submits it with their Schengen visa application at VFS/German embassy.",
  },
  {
    title: 'Family Reunion Visa — Bringing Spouse & Children',
    slug: 'guide-family-reunion-visa',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      "Spouse and children of Blue Card / residence permit holders can apply for a family reunion visa (Familiennachzug) at the German embassy in India. Requirements: proof of relationship (marriage certificate, birth certificates — apostilled), A1 German certificate for spouse (Goethe Institut), sufficient living space, adequate income, and health insurance. Children under 16 don't need a German certificate. Processing: 4-12 weeks.",
  },
  {
    title: 'Marriage Registration — Indian Couples in Germany',
    slug: 'guide-marriage-registration-germany',
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description:
      'To register a marriage performed in India, bring your Indian marriage certificate (apostilled), both passports, birth certificates, and Meldebescheinigung to the Standesamt (civil registry office). For marrying in Germany: apply at the Standesamt with an Ehefähigkeitszeugnis (certificate of no impediment) — Indians can get this from CGI Munich. Processing takes 6-12 weeks. A sworn translator is needed for all Hindi/regional language documents.',
  },

  // ── Driving ──
  {
    title: 'Driving Licence Conversion — Indian to German',
    slug: 'guide-driving-licence-conversion',
    resourceType: 'DRIVING',
    url: null,
    description:
      'Indian driving licences are NOT directly convertible in Germany — you must pass both the theory test (available in English, 30 multiple-choice questions) and the practical driving test. Steps: (1) enrol at a Fahrschule, (2) attend mandatory theory hours, (3) pass theory test at TÜV/DEKRA, (4) take practical lessons, (5) pass practical test. Total cost: €1,500-€2,500. Your Indian licence is valid for 6 months after arrival — drive with an official translation during that period.',
  },
  {
    title: 'Finding an English-Speaking Fahrschule',
    slug: 'guide-fahrschule-english-stuttgart',
    resourceType: 'DRIVING',
    url: null,
    description:
      'Several Fahrschulen (driving schools) in Stuttgart offer theory lessons in English. The theory test itself can be taken in English at TÜV or DEKRA. Ask Indian community WhatsApp groups for recommendations — many Indians have done this recently and can suggest good instructors. Budget: €200-€400 for theory + €1,200-€2,000 for practical lessons (number of lessons varies).',
  },
  {
    title: 'International Driving Permit (IDP)',
    slug: 'guide-international-driving-permit',
    resourceType: 'DRIVING',
    url: null,
    description:
      'An International Driving Permit (IDP) issued in India is technically valid in Germany for 6 months after arrival alongside your Indian licence. However, many car rental companies and insurance providers require a German or EU licence. Get your Indian licence translated by a sworn translator (beglaubigte Übersetzung) for day-to-day use. After 6 months, you MUST have a German licence.',
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
      'Stuttgart has a growing Indian restaurant scene with options ranging from budget dosa counters to upscale North Indian dining. Popular areas: Stadtmitte, Bad Cannstatt, Vaihingen (near uni). Many offer lunch buffets (€10-€15). Vegetarian-friendly options are common. For authentic home-style cooking, check community potluck events run by groups like Tamil Sangam and Malayalee Deutsches Treffen. Search "Indian restaurant Stuttgart" on Google Maps for current ratings.',
  },
  {
    title: 'Online Indian Grocery Delivery — Germany-Wide',
    slug: 'guide-online-indian-grocery-germany',
    resourceType: 'GROCERY_FOOD',
    url: null,
    description:
      'Several online stores deliver Indian groceries across Germany: desicorner.de, indischekost.de, and spicevillage.eu are popular. Delivery to Stuttgart usually takes 2-4 business days. Useful for bulk buys (25kg basmati rice, dal in bulk) and hard-to-find items (specific brands like MDH, Everest, Patanjali). Compare prices — local stores are sometimes cheaper for fresh items.',
  },

  // ── Jobs & Careers ──
  {
    title: 'Job Portals for Internationals in Germany',
    slug: 'guide-job-portals-internationals',
    resourceType: 'JOBS_CAREERS',
    url: null,
    description:
      'Key job portals: StepStone.de and Indeed.de (largest general boards), LinkedIn (strong for international roles), XING (German LinkedIn — important for local networking), Glassdoor.de (company reviews + jobs). For Stuttgart automotive: check career pages of Bosch, Mercedes-Benz, Porsche, ZF, Mahle, Continental directly. IT roles: check Stack Overflow Jobs and WeAreDevelopers. Agencies: Hays, Robert Half, Michael Page handle many Indian professional placements.',
  },
  {
    title: 'Freelance Visa — Self-Employment in Germany (§21 AufenthG)',
    slug: 'guide-freelance-visa-germany',
    resourceType: 'JOBS_CAREERS',
    url: null,
    description:
      'The freelance visa (Aufenthaltserlaubnis zur Ausübung einer selbständigen Tätigkeit, §21 AufenthG) lets non-EU citizens work as freelancers (Freiberufler) in Germany. Requirements: business plan, proof of clients, sufficient savings (€5,000+), health insurance, and a tax advisor (Steuerberater). Apply at the Ausländerbehörde. Processing: 2-4 months. Note: you cannot freelance on a Blue Card without a separate permit.',
  },
  {
    title: 'Agentur für Arbeit — Job Search & Unemployment Benefits',
    slug: 'guide-agentur-fuer-arbeit',
    resourceType: 'JOBS_CAREERS',
    url: 'https://www.arbeitsagentur.de/en/',
    description:
      "The Agentur für Arbeit (Federal Employment Agency) offers job placement, career counselling, and unemployment benefits (ALG I). If you lose your job, register immediately — ALG I is 60-67% of your last net salary for up to 12 months (if you've contributed for 12+ months). Blue Card holders: you have 3 months to find a new job before your residence permit is affected. The Stuttgart office is at Nordbahnhofstr. 30-34.",
  },

  // ── Tax & Finance ──
  {
    title: 'Annual Tax Declaration (Steuererklärung)',
    slug: 'guide-steuererklaerung-basics',
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de',
    description:
      'Every employee in Germany should file an annual tax return (Steuererklärung) — most Indians get €500-€2,000 back. File via ELSTER (free, official portal), tax software (WISO Steuer, SteuerGo — some in English), or a Steuerberater. Key deductions: commuting (Pendlerpauschale, €0.30/km), home office (€6/day), work equipment, language courses, moving costs, and double household maintenance (doppelte Haushaltsführung) if your family is still in India. Deadline: 31 July (or 28 Feb next year with a Steuerberater).',
  },
  {
    title: 'India-Germany DTAA — Double Taxation Avoidance',
    slug: 'guide-dtaa-india-germany',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      'The India-Germany Double Taxation Avoidance Agreement (DTAA) prevents you from being taxed twice on the same income. Key points: (1) Salary earned in Germany is taxed only in Germany, (2) Indian rental income: taxed in India, but you get a credit in Germany, (3) RSUs/ESOPs: complex — usually taxed in both, credit applies, (4) NRE account interest: tax-free in India, must be declared in Germany, (5) Capital gains on Indian mutual funds: declare in German return. A Steuerberater who understands DTAA is essential — not all do.',
  },
  {
    title: 'NRE & NRO Accounts — Managing Indian Finances from Germany',
    slug: 'guide-nre-nro-accounts',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      'As an NRI (Non-Resident Indian), you must convert your Indian savings accounts to NRE (Non-Resident External) or NRO (Non-Resident Ordinary). NRE: for parking foreign earnings in India — interest is tax-free in India, fully repatriable. NRO: for Indian-sourced income (rent, dividends) — taxed in India, limited repatriation ($1M/year). Notify your Indian bank within a reasonable time of moving abroad. Keep both types for flexibility.',
  },
  {
    title: 'ELSTER — Online Tax Filing Portal',
    slug: 'guide-elster-tax-portal',
    resourceType: 'TAX_FINANCE',
    url: 'https://www.elster.de',
    description:
      'ELSTER is the official German online tax filing system. Create an account (takes ~2 weeks for activation letter). You can file your Steuererklärung, change your tax class (Steuerklasse), and submit VAT returns here — all free. The interface is in German only, but browser translation works. Your Steuer-ID (11-digit number) arrives by post after Anmeldung and is used for all tax matters.',
  },
  {
    title: 'Finding an English-Speaking Steuerberater',
    slug: 'guide-steuerberater-english',
    resourceType: 'TAX_FINANCE',
    url: null,
    description:
      "A Steuerberater (tax advisor) costs €300-€1,500/year depending on complexity but often pays for itself in deductions you'd miss. For Indians: look for one who understands DTAA, RSU/ESOP taxation, and NRE/NRO accounts. Ask in Indian community WhatsApp groups for recommendations. Alternatively, tax software like WISO Steuer (€30/year, partly English) or SteuerGo (English) works for simpler cases. Steuerberater extends your filing deadline to February of the following year.",
  },

  // ── Business Setup ──
  {
    title: 'Freiberufler vs Gewerbe — Understanding the Difference',
    slug: 'guide-freiberufler-vs-gewerbe',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      "Germany distinguishes between Freiberufler (freelancers in regulated professions: IT consultants, engineers, doctors, teachers, artists) and Gewerbetreibende (tradespeople running a Gewerbe: shops, agencies, most online businesses). Key difference: Freiberufler don't pay Gewerbesteuer (trade tax) and have simpler bookkeeping. Your Finanzamt decides your classification. If you're an IT consultant from India — you're likely Freiberufler. If you open a restaurant — that's Gewerbe.",
  },
  {
    title: 'Gewerbeanmeldung — Trade Licence Registration',
    slug: 'guide-gewerbeanmeldung',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      "If you're starting a Gewerbe (not Freiberufler), register at the Gewerbeamt in Stuttgart. Bring: passport, residence permit (must allow self-employment), and the completed Gewerbeanmeldung form. Fee: ~€26. After registration you'll automatically be enrolled in the IHK (Chamber of Commerce, ~€150-€300/year) and receive a Gewerbeschein. You must also register with the Finanzamt separately.",
  },
  {
    title: 'Fragebogen zur steuerlichen Erfassung — Finanzamt Registration',
    slug: 'guide-fragebogen-steuerliche-erfassung',
    resourceType: 'BUSINESS_SETUP',
    url: null,
    description:
      "Every new business (Freiberufler or Gewerbe) must register with the Finanzamt using the Fragebogen zur steuerlichen Erfassung. This 8-page form (available on ELSTER) asks about your business type, expected revenue, and VAT status. Key decision: Kleinunternehmerregelung (small business exemption) — if revenue <€22,000/year, you can skip charging VAT (simpler, but you can't reclaim VAT on purchases). Processing: 4-8 weeks to get your Steuernummer.",
  },

  // ── Family & Children ──
  {
    title: 'Kindergeld — Child Benefit for Non-EU Families',
    slug: 'guide-kindergeld-non-eu',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://familienportal.de/familienportal/familienleistungen/kindergeld',
    description:
      "Kindergeld (child benefit) is €250/month per child. Non-EU citizens are eligible if they have a residence permit that allows employment (Blue Card, work permit). Apply at the Familienkasse (part of Agentur für Arbeit) with: birth certificate (apostilled + translated), passport, residence permit, Meldebescheinigung, and Steuer-ID for both parent and child. Children don't need to live in Germany — but the child must be registered. Processing: 4-6 weeks. Retrospective claim: up to 6 months.",
  },
  {
    title: 'Elterngeld — Parental Allowance',
    slug: 'guide-elterngeld-parental-allowance',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://familienportal.de/familienportal/familienleistungen/elterngeld',
    description:
      "Elterngeld replaces 65-67% of your net income (up to €1,800/month) for 12-14 months after a child's birth. Both parents can split this. ElterngeldPlus lets you work part-time and receive reduced Elterngeld for up to 28 months. Apply at the L-Bank (Baden-Württemberg) within the first 3 months of birth — it's only paid retroactively for 3 months. Documents: birth certificate, salary slips (last 12 months), tax ID, residence permit. Non-EU parents are eligible with a work permit.",
  },
  {
    title: 'Mutterschutz & Elternzeit — Maternity Leave & Parental Leave',
    slug: 'guide-mutterschutz-elternzeit',
    resourceType: 'FAMILY_CHILDREN',
    url: null,
    description:
      'Mutterschutz (maternity protection): 6 weeks before due date + 8 weeks after birth — full pay, job protected. Elternzeit (parental leave): up to 3 years per parent, job guaranteed — can be taken by fathers too. You can work up to 32 hours/week during Elternzeit. Notify your employer in writing at least 7 weeks before start. Both parents can take Elternzeit simultaneously. This is a legal right — employers cannot refuse.',
  },
  {
    title: 'Kita & Kindergarten Search — Stuttgart',
    slug: 'guide-kita-kindergarten-stuttgart',
    resourceType: 'FAMILY_CHILDREN',
    url: 'https://kitafinder.stuttgart.de',
    description:
      'Use kitafinder.stuttgart.de to search and apply for Kita/Kindergarten spots in Stuttgart. Register early — waitlists can be 6-12+ months. Children have a legal right to a Kita place from age 1. Costs: income-dependent, typically €0-€400/month (meals extra). Types: Krippe (0-3 years), Kindergarten (3-6 years), Ganztag (full-day). Apply to multiple Kitas in your area. Some Kitas have bilingual (German-English) programs — ask specifically.',
  },
  {
    title: 'School Enrollment — For Indian Families',
    slug: 'guide-school-enrollment-stuttgart',
    resourceType: 'FAMILY_CHILDREN',
    url: null,
    description:
      "Children in BW must attend school from age 6. Enrollment: register at the Grundschule (primary, ages 6-10) assigned to your residential district. Bring: child's passport, birth certificate, Meldebescheinigung, vaccination record (Masern-Impfpflicht — measles vaccination is mandatory). For children who don't speak German: Vorbereitungsklassen (VKL, preparatory classes) are available at many schools. International schools (e.g., International School of Stuttgart) are an alternative but cost €15,000-€20,000/year.",
  },

  // ── Health & Doctors ──
  {
    title: 'Health Insurance — GKV vs PKV',
    slug: 'guide-health-insurance-gkv-pkv',
    resourceType: 'HEALTH_DOCTORS',
    url: null,
    description:
      "Health insurance is mandatory in Germany. Two types: GKV (public — TK, AOK, Barmer; ~14.6% of gross salary, split with employer) and PKV (private — only if earning >€69,300/year or self-employed). GKV: covers family members free, income-based premiums. PKV: lower premiums when young, but increases with age and doesn't cover family. Most Indians on Blue Card start with GKV (TK is the most popular among expats — English-friendly). Switch to PKV only after careful analysis.",
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
    resourceType: 'HEALTH_DOCTORS',
    url: null,
    description:
      'Emergency: 112 (ambulance, fire — free, available everywhere). Police: 110. Non-emergency medical: 116 117 (ärztlicher Bereitschaftsdienst — after-hours doctor service). Nearest hospitals with emergency rooms (Notaufnahme): Katharinenhospital (Kriegsbergstr. 60), Marienhospital (Böheimstr. 37), Robert-Bosch-Krankenhaus (Auerbachstr. 110). Pharmacy emergency (Apothekennotdienst): apotheken.de shows which pharmacies are open 24/7. Keep your insurance card in your wallet.',
  },

  // ── Housing ──
  {
    title: 'Apartment Search in Stuttgart',
    slug: 'guide-apartment-search-stuttgart',
    resourceType: 'HOUSING',
    url: null,
    description:
      "Stuttgart has a tight housing market. Key portals: ImmoScout24.de (largest), WG-Gesucht.de (shared flats/WGs), eBay Kleinanzeigen (private listings), immowelt.de. Budget for Kaltmiete (cold rent without utilities): €12-€18/sqm. Deposit (Kaution): max 3 months' cold rent. Always get a Wohnungsgeberbestätigung from your landlord for Anmeldung. For Indians arriving fresh: temporary furnished apartments (wunderflats.com, homelike.com) for the first 1-3 months while searching.",
  },
  {
    title: 'Schufa — Credit Score in Germany',
    slug: 'guide-schufa-credit-score',
    resourceType: 'HOUSING',
    url: 'https://www.schufa.de',
    description:
      'Schufa is Germany\'s credit reporting agency. Many landlords and banks require a Schufa-Auskunft (credit report). New arrivals have no Schufa history — this isn\'t negative, it just means no data. Get your free annual report: meineschufa.de → "Datenkopie (nach Art. 15 DS-GVO)" (free, takes 1-4 weeks by post). The paid "BonitätsAuskunft" (€29.95) is faster and formatted for landlords. Building Schufa: get a German bank account, pay bills by Lastschrift (direct debit), and use a mobile plan (not prepaid).',
  },
  {
    title: 'GEZ / Rundfunkbeitrag — TV & Radio License Fee',
    slug: 'guide-gez-rundfunkbeitrag',
    resourceType: 'HOUSING',
    url: 'https://www.rundfunkbeitrag.de',
    description:
      "Every household in Germany pays €18.36/month for the Rundfunkbeitrag (public broadcasting fee), regardless of whether you own a TV. You're automatically registered after Anmeldung and will receive a payment letter. One fee per household (not per person). Pay by Lastschrift to avoid forgetting. If you receive social benefits (Bürgergeld), you can apply for an exemption (Befreiung). This fee is NOT optional and debts accumulate with penalties.",
  },
];

/* ────────────────────────────────────────────────────────────────────────
 *  Reconciler
 * ──────────────────────────────────────────────────────────────────────── */

export type ResourcesResult = {
  created: number;
  skippedExisting: number;
  skippedMissingCity: number;
};

export async function runResourcesSeed(): Promise<ResourcesResult> {
  const result: ResourcesResult = {
    created: 0,
    skippedExisting: 0,
    skippedMissingCity: 0,
  };

  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityIdBySlug = new Map(cities.map((c) => [c.slug, c.id]));

  for (const entry of RESOURCE_DEFS) {
    const citySlug = entry.citySlug ?? 'stuttgart';
    const cityId = cityIdBySlug.get(citySlug);
    if (!cityId) {
      console.warn(`  ⚠ ${entry.slug}: city "${citySlug}" not found (run bootstrap?) — skipped`);
      result.skippedMissingCity++;
      continue;
    }

    const existing = await prisma.resource.findUnique({
      where: { slug: entry.slug },
      select: { id: true },
    });
    if (existing) {
      result.skippedExisting++;
      continue;
    }

    try {
      await prisma.resource.create({
        data: {
          title: entry.title,
          slug: entry.slug,
          resourceType: entry.resourceType,
          url: entry.url,
          description: entry.description,
          validFrom: entry.validFrom ?? null,
          validUntil: entry.validUntil ?? null,
          cityId,
          source: 'ADMIN_SEED',
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
  if (r.skippedMissingCity > 0) {
    console.log(`   ⚠ ${r.skippedMissingCity} skipped because city was missing`);
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
