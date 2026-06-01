/**
 * "Indian events this week" window logic - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports). Computes the date window for the
 * GET /api/v1/discovery/:slug/events feed and builds the query string. Mirrors
 * the web /indian-events-this-week surface: default to the next 7 days, and
 * when that returns nothing, widen to 30 days so the screen is never empty.
 */

export const THIS_WEEK_DAYS = 7;
export const FALLBACK_DAYS = 30;

const DAY_MS = 1000 * 60 * 60 * 24;

export interface EventsWindow {
  fromIso: string;
  toIso: string;
  days: number;
}

/** The default 7-day window starting now. */
export function thisWeekWindow(now: Date = new Date()): EventsWindow {
  return windowOf(now, THIS_WEEK_DAYS);
}

/** The widened 30-day fallback window starting now. */
export function fallbackWindow(now: Date = new Date()): EventsWindow {
  return windowOf(now, FALLBACK_DAYS);
}

function windowOf(now: Date, days: number): EventsWindow {
  const from = new Date(now.getTime());
  const to = new Date(now.getTime() + days * DAY_MS);
  return { fromIso: from.toISOString(), toIso: to.toISOString(), days };
}

/** Build the events feed query string for a city + window. */
export function buildEventsQuery(window: EventsWindow, limit = 50): string {
  const params = new URLSearchParams({
    from: window.fromIso,
    to: window.toIso,
    limit: String(limit),
  });
  return params.toString();
}

/** Full path for the discovery events feed. */
export function eventsFeedPath(citySlug: string, window: EventsWindow, limit = 50): string {
  return `/api/v1/discovery/${encodeURIComponent(citySlug)}/events?${buildEventsQuery(window, limit)}`;
}

/** Group events into "Today", "This weekend", and "Later" buckets by start date. */
export interface DatedEvent {
  startsAt: string;
}

export type EventBucket = 'today' | 'weekend' | 'later';

export function bucketForEvent(event: DatedEvent, now: Date = new Date()): EventBucket {
  const start = new Date(event.startsAt);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / DAY_MS);

  if (diffDays <= 0) return 'today';

  // Weekend = upcoming Saturday/Sunday within the next 7 days.
  const dow = start.getDay(); // 0 Sun … 6 Sat
  if (diffDays <= 7 && (dow === 0 || dow === 6)) return 'weekend';

  return 'later';
}
