/**
 * Types for the AI content pipeline.
 *
 * Architecture: Generic search → cheap relevance filter → batch LLM extraction → dedup → review queue
 *
 * Design principles (optimised for all-Europe scale):
 *  1. Search broad, filter with AI — don't hardcode per-city sources
 *  2. Two-stage LLM — cheap model filters relevance, expensive model extracts
 *  3. Batch calls — multiple items per LLM request to amortise system prompt tokens
 *  4. LLM assigns city — extraction output includes cityName, not config input
 *  5. Region config, not city config — add a country by adding keywords + search region
 */

// ─── Source types ──────────────────────────────────────

/** Every source type the pipeline knows how to fetch */
export type SourceType =
  | 'EVENTBRITE'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'WEBSITE_SCRAPE'
  | 'CGI_MUNICH'
  | 'INDOEUROPEAN'
  | 'GOOGLE_ALERT'
  | 'GOOGLE_SEARCH'
  | 'DUCKDUCKGO'
  | 'MEETUP'
  | 'COMMUNITY_SUGGESTION'
  | 'DB_COMMUNITY';

/** Raw content fetched from any source adapter */
export type RawContent = {
  sourceType: SourceType;
  sourceUrl: string;
  text: string;
  imageUrls?: string[];
  fetchedAt: string; // ISO 8601
};

/** Result from a source adapter fetch */
export type FetchResult = {
  sourceId: string;
  items: RawContent[];
  errors: string[];
};

// ─── Search strategy (replaces per-city SourceConfig) ──

/**
 * A search strategy defines HOW to discover content, not WHERE.
 * The same strategy works for Stuttgart or Stockholm.
 */
export type SearchStrategy = {
  /** Unique identifier */
  id: string;
  sourceType: SourceType;
  /** Human label */
  label: string;
  enabled: boolean;
} & (
  | {
      /** Keyword-based search (Eventbrite, Meetup) — searches region-wide */
      kind: 'keyword_search';
      /** Search keywords — combined with region at runtime */
      keywords: string[];
      /** Search radius from region center */
      radiusKm: number;
    }
  | {
      /** Known URL — a specific high-value page (CGI Munich, IndoEuropean, Facebook page) */
      kind: 'pinned_url';
      url: string;
      /** Optional: if we know the city in advance (e.g. CGI Munich serves all BaWü) */
      hintCitySlug?: string;
    }
);

/**
 * A region to scan. Each region runs all keyword_search strategies.
 * Pinned URLs run independently of regions.
 */
export type SearchRegion = {
  id: string;
  label: string;
  /** Center point for radius-based API searches (e.g. "Stuttgart, Germany") */
  searchCenter: string;
  /** City slugs this region covers — used to match LLM city output to DB */
  citySlugs: string[];
  enabled: boolean;
};

// ─── Two-stage LLM types ───────────────────────────────

/** Stage 1 output: cheap relevance check */
export type RelevanceResult = {
  index: number; // position in the batch
  isRelevant: boolean;
  reason: string; // brief explanation
};

// ─── Extraction types (LLM output) ────────────────────

/** Structured event data — now includes city assignment */
export type ExtractedEvent = {
  type: 'EVENT';
  title: string;
  description: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  endDate: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  cityName: string | null; // LLM-assigned city name (e.g. "Stuttgart")
  isOnline: boolean;
  isFree: boolean | null;
  cost: string | null;
  registrationUrl: string | null;
  imageUrl: string | null;
  hostCommunity: string | null;
  categories: string[]; // category slugs
  languages: string[];
  confidence: number; // 0-1
  fieldConfidence: Record<string, number>;
};

/** Structured community data — now includes city assignment */
export type ExtractedCommunity = {
  type: 'COMMUNITY';
  name: string;
  description: string | null;
  cityName: string | null; // LLM-assigned
  categories: string[];
  languages: string[];
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  contactEmail: string | null;
  confidence: number;
  fieldConfidence: Record<string, number>;
};

export type ExtractedData = ExtractedEvent | ExtractedCommunity;

// ─── Pipeline run metrics ──────────────────────────────

export type PipelineRunResult = {
  regionsScanned: number;
  sourcesProcessed: number;
  itemsFetched: number;
  itemsPassedFilter: number;
  itemsExtracted: number;
  itemsQueued: number;
  itemsSkippedDuplicate: number;
  itemsSkippedNoCity: number;
  errors: string[];
  llmCalls: number;
  llmTokensEstimate: number;
  duration: number; // ms
};
