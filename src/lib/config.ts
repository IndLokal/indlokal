/**
 * Site-wide configuration constants.
 * Single source of truth for values referenced across modules.
 */

export const siteConfig = {
  name: 'LocalPulse',
  tagline: 'The real-time guide to Indian communities and events near you.',
  description:
    'Discover Indian communities, events, and cultural activities in your German city. Find what is happening this week for the Indian diaspora.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://localpulse.de',
} as const;

/** Launch city slugs that are currently active */
export const ACTIVE_CITIES = ['stuttgart', 'karlsruhe', 'mannheim'] as const;

/** Default number of items in paginated lists */
export const PAGE_SIZE = 20;

/** Scoring thresholds */
export const SCORING = {
  /** Days with no activity before a community is considered stale */
  STALE_THRESHOLD_DAYS: 90,
  /** Days before a stale badge is shown to users */
  STALE_BADGE_DAYS: 180,
  /** Minimum items in "this week" before auto-expanding to "this month" */
  SPARSE_CONTENT_THRESHOLD: 3,
} as const;

/** All 11 MVP categories (slugs) */
export const CATEGORIES = [
  'cultural',
  'student',
  'professional',
  'religious',
  'language-regional',
  'sports-fitness',
  'family-kids',
  'networking-social',
  'food-cooking',
  'arts-entertainment',
  'consular-official',
] as const;
