/**
 * Discovery Module
 *
 * Powers the city feed - the primary discovery surface.
 * Orchestrates community, event, and resource data into
 * the activity-led feed users see.
 *
 * Responsibilities:
 * - City feed composition (this week, active communities, categories)
 * - Sparse-content resilience
 * - Upcoming-focused event visibility
 * - Cross-module data aggregation
 */
export { getCityFeed, getCitiesList, getCityDetail, getTrending } from './queries';
export type { CityFeedData } from './types';
