/**
 * Feature flags — controlled via environment variables.
 * All flags default to enabled unless explicitly disabled with `=false`.
 */
export const FLAGS = {
  /** Report & suggest flows (POST /api/v1/reports). Disable via FEATURE_REPORT=false */
  reportEnabled: process.env.FEATURE_REPORT !== 'false',
} as const;
