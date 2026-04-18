/** Scoring thresholds */
export const SCORING = {
  /** Days with no activity before a community is considered stale */
  STALE_THRESHOLD_DAYS: 90,
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
