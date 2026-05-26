/**
 * Pipeline configuration — regions + fallback source strategies.
 *
 * KEY DESIGN: DB and pinned sources are the primary discovery surface.
 * Keyword strategies are fallback discovery intents; source-plan.ts decides
 * whether to use them based on DB coverage gaps.
 *
 * Token efficiency:
 *  - Keyword strategies search broad → cheap pre-filter drops irrelevant items
 *  - Pinned URLs go straight to extraction (they're known high-value)
 *  - Batch LLM calls amortise system prompt tokens across 5-10 items
 */

import type { SearchStrategy, SearchRegion } from './types';
import { assessEvidenceUrl } from '../../lib/source-policy';
import { SATELLITE_CITY_DATA } from '../../lib/config/cities';

function getRegionCitySlugs(metroSlugs: string[]): string[] {
  const satellites = SATELLITE_CITY_DATA.filter(
    (city) => city.metroSlug && metroSlugs.includes(city.metroSlug),
  ).map((city) => city.slug);

  return Array.from(new Set([...metroSlugs, ...satellites]));
}

// ─── Diaspora search keywords ──────────────────────────
// Fallback seeds for forced/gap keyword search. City-specific gap keywords are
// generated in source-plan.ts from DB coverage, so this list should stay small.

export const DIASPORA_KEYWORDS = [
  // Baseline discovery intent (city context is appended at runtime)
  'Indian community meetup',
  'South Asian community meetup',
  'Indian networking meetup',
  'Indian cultural workshop',
  'Indian volunteer group',
  'Indian student club',
  'South Asian student association',
  'Indian professionals network',
  'Indian startup meetup',
  'Indian founder meetup',
  'Indian entrepreneur network',
  'Indian career fair',
  'Indian tech talk',
  'Indian product meetup',
  'new Indian chapter',
  'new Indian association',
  'Indian cultural event',
  'South Asian festival',
  'indische Community Treffen',
  'indischer Kulturverein Gruendung',
  'suedasiatische Community Veranstaltung',
] as const;

// ─── Search regions ────────────────────────────────────

export const SEARCH_REGIONS: SearchRegion[] = [
  {
    id: 'baden-wuerttemberg',
    label: 'Baden-Württemberg',
    searchCenter: 'Stuttgart, Germany',
    citySlugs: getRegionCitySlugs(['stuttgart', 'karlsruhe', 'mannheim']),
    enabled: true,
  },
  {
    id: 'bavaria',
    label: 'Bavaria',
    searchCenter: 'Munich, Germany',
    citySlugs: getRegionCitySlugs(['munich']),
    enabled: true,
  },
  {
    id: 'hesse',
    label: 'Hesse',
    searchCenter: 'Frankfurt, Germany',
    citySlugs: getRegionCitySlugs(['frankfurt']),
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
    // German discovery phrasing, and launch/join signals.
    keywords: [
      '"Indian community meetup" OR "South Asian community meetup" OR "Indian networking meetup"',
      '"Indian startup meetup" OR "Indian founder meetup" OR "Indian entrepreneur network"',
      '"Indian career fair" OR "Indian tech talk" OR "Indian product meetup"',
      '"new Indian chapter" OR "new Indian association" OR "community launch" "Indian"',
      '"Indian student club" OR "South Asian student association" OR "Indian alumni group"',
      '"Indian volunteer group" OR "join Indian community" OR "Indian professionals network"',
      // German-language discovery phrasing for newly formed or informal groups.
      '"indische Community Treffen" OR "indischer Kulturverein Gruendung" OR "indische Gruppe"',
      '"suedasiatische Community Veranstaltung" OR "kulturelles Indien Event"',
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
      'Indian community meetup',
      'South Asian community meetup',
      'Indian networking meetup',
      'Indian cultural event',
      'Indian volunteer group',
      'Indian student club',
      'South Asian student association',
      'Indian professionals network',
      'Indian startup meetup',
      'Indian founder meetup',
      'Indian entrepreneur network',
      'Indian career fair',
      'Indian tech talk',
      'Indian product meetup',
      'new Indian chapter',
      'new Indian association',
      'indische Community Treffen',
      'indischer Kulturverein Gruendung',
      'suedasiatische Community Veranstaltung',
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
    id: 'web-cgi-frankfurt',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Consulate General of India Frankfurt — Official Notices & Outreach',
    url: 'https://cgifrankfurt.gov.in/',
    hintCitySlug: 'frankfurt',
    enabled: true,
  },
  {
    id: 'web-indian-embassy-berlin',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'Embassy of India Berlin — Official Notices & Community Outreach',
    url: 'https://indianembassyberlin.gov.in/',
    enabled: true,
  },
  {
    id: 'web-mea-germany-missions',
    sourceType: 'WEBSITE_SCRAPE',
    kind: 'pinned_url',
    label: 'MEA India — Germany Missions Directory',
    url: 'https://www.mea.gov.in/indian-missions-abroad-new.htm?country=Germany',
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
