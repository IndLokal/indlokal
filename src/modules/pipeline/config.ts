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

// ─── Diaspora search keywords ──────────────────────────
// Shared across all keyword_search strategies.
// These are intentionally broad — the LLM relevance filter narrows later.

export const DIASPORA_KEYWORDS = [
  // Community / cultural identifiers
  'Indian',
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
  'Eid',
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
  // Regional / language communities (comprehensive)
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Hindi',
  'Gujarati',
  'Punjabi',
  'Bengali',
  'Marathi',
  'Odia', // Odisha community
  'Assamese',
  'Konkani',
  'Rajasthani',
  'Sindhi',
  'Kashmiri',
  // Activities
  'Cricket',
  'Bhangra',
  'Kathak',
  'Bharatanatyam',
  'Yoga India',
  'Curry festival',
  'Indian food',
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
    citySlugs: ['stuttgart', 'karlsruhe', 'mannheim'],
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
    // Targeted compound queries — these find WhatsApp-only groups
    // mentioned on blogs, directories, university pages, etc.
    keywords: [
      'Indian community',
      'Indian association',
      'Indian Verein', // German: association
      'Telugu association',
      'Tamil Sangam',
      'Bengali association',
      'Odia association',
      'Jain Sangh',
      'JITO chapter',
      'Gujarati Samaj',
      'Punjabi association',
      'Marathi Mandal',
      'Malayalam association',
      'Kannada Sangha',
      'Indian WhatsApp group',
      'Desi community',
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
  );
}
