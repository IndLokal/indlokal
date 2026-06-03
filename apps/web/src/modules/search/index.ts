/**
 * Search Module
 *
 * Full-text search across communities and events, city-scoped by default.
 * MVP uses PostgreSQL full-text search (tsvector/tsquery).
 * Designed for later migration to Meilisearch/Elasticsearch.
 *
 * Responsibilities:
 * - Free-text search across communities and events
 * - City-scoped search
 * - Autocomplete suggestions from approved keywords
 * - Trending keywords
 * - Search signal logging (zero-result tracking)
 */
export {
  searchCommunities,
  searchEvents,
  searchResources,
  getSuggestions,
  getTrendingKeywords,
  searchAll,
} from './queries';
export type {
  SearchResultRow,
  SearchAllOptions,
  SearchAllResult,
  ResourceSearchItem,
} from './queries';
export { recordSearchInteraction } from './telemetry';
export type { SearchScope, SearchEntityFilter, SearchTelemetryInput } from './telemetry';
