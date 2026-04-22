/**
 * Event Module
 *
 * Events are the primary retention driver — "what's happening this week?"
 * Time-sensitive, temporal-first entity.
 *
 * Responsibilities:
 * - CRUD for events
 * - Temporal queries (this week, this month, upcoming)
 * - Sparse-content resilience (auto-expand time window)
 * - Past event archival (not deletion — feeds activity scores)
 */
export { getUpcomingEvents, getEventBySlug, getEventsThisWeek } from './queries';
export type { EventWithRelations, EventListItem } from './types';
