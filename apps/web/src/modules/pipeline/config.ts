/**
 * Pipeline configuration — regions + search strategies.
 *
 * KEY DESIGN: Separate WHAT to search (strategies) from WHERE to search (regions).
 * Adding a new country = add a region. Adding a new source = add a strategy.
 * They combine at runtime via the orchestrator.
 *
 * Token efficiency:
 *  - Keyword strategies search broad → cheap pre-filter drops irrelevant items
 *  - Pinned URLs go straight to extraction (they're known high-value)
 *  - Batch LLM calls amortise system prompt tokens across 5-10 items
 */

import type { SearchStrategy, SearchRegion } from './types';
import { assessEvidenceUrl } from '../../lib/source-policy';

// ─── Diaspora search keywords ──────────────────────────
// Shared across all keyword_search strategies.
// These are intentionally broad — the LLM relevance filter narrows later.

export const DIASPORA_KEYWORDS = [
  // Community / cultural identifiers (specific — avoids "Indian restaurant" noise)
  'Bollywood',
  'Desi',
  'South Asian',
  // Organisation types (catches JITO, Tamil Sangam, Jain Sangh, etc.)
  'Indian Sangam',
  'Indian Sangh',
  'Indian Samaj',
  'Indian Mandal',
  'Indian Mandir',
  'Indian Sabha',
  'Indian Association',
  'Indian Verein', // German for association
  'JITO', // Jain International Trade Organisation
  // Festivals (strongest event signals)
  'Diwali',
  'Holi',
  'Pongal',
  'Onam',
  'Navratri',
  'Durga Puja',
  'Ganesh Chaturthi',
  'Janmashtami',
  'Janma Kalyanak', // Jain festival
  'Paryushana', // Jain festival
  'Baisakhi',
  'Lohri',
  'Ugadi',
  'Bihu',
  'Rath Yatra',
  // Religious / spiritual communities
  'Jain',
  'Sikh',
  'Gurdwara',
  'Hindu Temple',
  'Kovil', // Tamil temple
  // Performing arts (specific to South Asian diaspora)
  'Bhangra',
  'Kathak',
  'Bharatanatyam',
  // Student / professional
  'Indian student association',
  'Indian professionals',
] as const;

// ─── Search regions ────────────────────────────────────

export const SEARCH_REGIONS: SearchRegion[] = [
  {
    id: 'baden-wuerttemberg',
    label: 'Baden-Württemberg',
    searchCenter: 'Stuttgart, Germany',
    citySlugs: [
      'stuttgart',
      'karlsruhe',
      'mannheim',
      'heidelberg-sat',
      'ludwigshafen',
      'weinheim',
      'schwetzingen',
      'speyer',
      'worms',
      'frankenthal',
      'hockenheim',
    ],
    enabled: true,
  },
  {
    id: 'bavaria',
    label: 'Bavaria',
    searchCenter: 'Munich, Germany',
    citySlugs: [
      'munich',
      'garching',
      'freising',
      'augsburg',
      'erding',
      'dachau',
      'fuerstenfeldbruck',
      'unterschleissheim',
      'starnberg',
    ],
    enabled: true,
  },
  {
    id: 'hesse',
    label: 'Hesse',
    searchCenter: 'Frankfurt, Germany',
    citySlugs: [
      'frankfurt',
      'offenbach',
      'darmstadt-sat',
      'mainz',
      'wiesbaden',
      'hanau',
      'ruesselsheim',
      'bad-homburg',
      'neu-isenburg',
    ],
    enabled: true,
  },
];

// ─── Search strategies ─────────────────────────────────

export const SEARCH_STRATEGIES: SearchStrategy[] = [
  // ── Keyword-based (run once per region) ──
  {
    id: 'eventbrite-keyword',
    sourceType: 'EVENTBRITE',
    kind: 'keyword_search',
    label: 'Eventbrite keyword search',
    keywords: [...DIASPORA_KEYWORDS],
    radiusKm: 50,
    enabled: true,
  },
  {
    id: 'google-cse-keyword',
    sourceType: 'GOOGLE_SEARCH',
    kind: 'keyword_search',
    label: 'Google Custom Search — diaspora communities',
    // Compound OR queries reduce API calls while covering English names,
    // German Verein names, and official portal vocabulary.
    keywords: [
      '"Indian community" OR "Indian association" OR "Indian Verein" OR "Desi community"',
      '"Tamil Sangam" OR "Telugu association" OR "Bengali association" OR "Odia association"',
      '"JITO chapter" OR "Jain Sangh" OR "Gujarati Samaj" OR "Marathi Mandal"',
      '"Punjabi association" OR "Malayalam association" OR "Kannada Sangha" OR "Hindu Mandir"',
      // German-language Verein naming — finds registered e.V. orgs on city portals,
      // umbrella org sites, and local news that use German rather than English.
      '"indischer Verein" OR "indische Gesellschaft" OR "Deutsch-Indische" OR "indisches Kulturzentrum"',
      '"Mitgliedsvereine" OR "Migrantenorganisationen" OR "Vereinsberatung" "indisch"',
    ],
    radiusKm: 100, // not used by Google CSE, kept for interface compat
    enabled: true,
  },

  // ── DuckDuckGo free web search (no API key needed) ──
  {
    id: 'duckduckgo-keyword',
    sourceType: 'DUCKDUCKGO',
    kind: 'keyword_search',
    label: 'DuckDuckGo web search — diaspora communities',
    keywords: [
      'Indian community',
      'Indian association Verein',
      'Indischer Verein e.V.',
      'Deutsch-Indische Gesellschaft',
      'Indisches Kulturzentrum',
      'Migrantenorganisationen indisch',
      'Telugu association',
      'Tamil Sangam',
      'JITO chapter Jain',
      'Marathi Mandal',
      'Kannada Koota',
      'Malayalam association',
      'Gujarati Samaj',
      'Indian Diwali festival',
      'Holi celebration Indian',
      'Hindu temple Mandir',
      'Indian student association',
      'Bollywood event',
      'Indian cricket club',
    ],
    radiusKm: 100,
    enabled: true,
  },

  // ── Pinned high-value URLs (region-independent) ──
  // External aggregators & consular pages — NOT in our communities DB
  {
    id: 'cgi-munich-events',
    sourceType: 'CGI_MUNICH',
    kind: 'pinned_url',
    label: 'CGI Munich — Event Gallery',
    url: 'https://www.cgimunich.gov.in/eventgallery',
    enabled: true,
  },
  {
    id: 'indoeuropean-events',
    sourceType: 'INDOEUROPEAN',
    kind: 'pinned_url',
    label: 'IndoEuropean.eu — Events',
    url: 'https://indoeuropean.eu/category/events/',
    enabled: true,
  },
  {
    id: 'indoeuropean-germany',
    sourceType: 'INDOEUROPEAN',
    kind: 'pinned_url',
    label: 'IndoEuropean.eu — Germany',
    url: 'https://indoeuropean.eu/country/germany/',
    enabled: true,
  },
  {
    id: 'web-indoeuropean-associations',
    sourceType: 'INDOEUROPEAN',
    kind: 'pinned_url',
    label: 'IndoEuropean.eu — Indian Associations in Germany',
    url: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    enabled: true,
  },
  {
    id: 'web-indoeuropean-association-category',
    sourceType: 'INDOEUROPEAN',
    kind: 'pinned_url',
    label: 'IndoEuropean.eu — Association Category',
    url: 'https://indoeuropean.eu/category/association/',
    enabled: true,
  },
  {
    id: 'web-indoeuropean-temples',
    sourceType: 'INDOEUROPEAN',
    kind: 'pinned_url',
    label: 'IndoEuropean.eu — Temples',
    url: 'https://indoeuropean.eu/category/temples/',
    enabled: true,
  },
  {
    id: 'web-indiansingermany-events',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Indians in Germany — Events',
    url: 'https://indiansingermany.org/events',
    enabled: true,
  },
  {
    id: 'web-aigev',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Association of Indians in Germany e.V.',
    url: 'https://www.aigev.org/',
    enabled: true,
  },
  {
    id: 'web-diz-bw',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'DIZ Baden-Württemberg e.V.',
    url: 'https://diz-ev.de/bawue',
    enabled: true,
  },
  {
    id: 'web-stuttgartexpats-events',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Stuttgart Expats — Events (general expat, cross-reference)',
    url: 'https://stuttgartexpats.com/events',
    enabled: true,
  },

  // ── German government & umbrella org listings ──
  // City/state portals and Dachverbände maintain official directories of
  // registered migrant Vereine. The LLM extraction pass picks out Indian /
  // South Asian orgs automatically. High yield: orgs without their own
  // website are still listed here.
  //
  // Note: vereinsregister.de / handelsregister.de are search-driven (POST
  // forms) and cannot be added as static pinned URLs. They are referenced in
  // directory.ts for humans doing manual research.
  {
    id: 'web-forum-der-kulturen-stuttgart',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Forum der Kulturen Stuttgart — Member Associations (160+ Vereine)',
    url: 'https://www.forum-der-kulturen.de/das-forum/mitgliedsvereine/',
    enabled: true,
  },
  {
    id: 'web-house-of-resources-stuttgart-map',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'House of Resources Stuttgart — Stadtteilkarte migrantischer Vereine',
    url: 'https://house-of-resources-stuttgart.de/stadtteilkarte-kontakt-zu-vereinen/',
    enabled: true,
  },
  {
    id: 'web-amka-frankfurt',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'AMKA Frankfurt — Amt für multikulturelle Angelegenheiten (official city office)',
    url: 'https://www.amka.de/',
    enabled: true,
  },
  {
    id: 'web-amka-frankfurt-vereine',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'AMKA Frankfurt — Registered Multicultural Associations directory',
    url: 'https://www.amka.de/vereine',
    enabled: true,
  },
  {
    id: 'web-vielfalt-bewegt-frankfurt',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Vielfalt bewegt Frankfurt — official diversity portal',
    url: 'https://www.vielfalt-bewegt-frankfurt.de/',
    enabled: true,
  },
  {
    id: 'web-integrationsbeauftragter-bw',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Baden-Württemberg Integrationsministerium — Migrant Organisations',
    url: 'https://sozialministerium.baden-wuerttemberg.de/de/integration/',
    enabled: true,
  },
  {
    id: 'web-morgen-muenchen-mitglieder',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'MORGEN München — migrant organisation member associations',
    url: 'https://morgen-muenchen.de/thema/mitgliedervereine/',
    enabled: true,
  },

  // ── Community-specific URLs now come from the database automatically ──
  // See db-sources.ts — communities with WEBSITE/MEETUP access channels
  // are auto-generated as pinned_url strategies at runtime.
  // Facebook pages are excluded: Meta blocks unauthenticated scraping (HTTP 400).
];

// ─── Helpers ───────────────────────────────────────────

export function getEnabledRegions(): SearchRegion[] {
  return SEARCH_REGIONS.filter((r) => r.enabled);
}

export function getKeywordStrategies(): (SearchStrategy & { kind: 'keyword_search' })[] {
  return SEARCH_STRATEGIES.filter(
    (s): s is SearchStrategy & { kind: 'keyword_search' } =>
      s.enabled && s.kind === 'keyword_search',
  );
}

export function getPinnedStrategies(): (SearchStrategy & { kind: 'pinned_url' })[] {
  return SEARCH_STRATEGIES.filter(
    (s): s is SearchStrategy & { kind: 'pinned_url' } => s.enabled && s.kind === 'pinned_url',
  ).filter((strategy) => {
    const evidence = assessEvidenceUrl(strategy.url);
    if (!evidence.isQualifying) {
      console.warn(
        `[Pipeline] Disabled pinned URL ${strategy.id}: ${evidence.label} (${strategy.url})`,
      );
      return false;
    }
    return true;
  });
}
