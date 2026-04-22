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
 * - Search signal logging (zero-result tracking)
 */
export { searchCommunities, searchEvents } from './queries';
