/**
 * Pipeline-wide HTTP client constants.
 *
 * Centralized here so changing the User-Agent or default timeouts requires a
 * single edit, and so all outbound pipeline fetches identify IndLokal consistently.
 */

export const PIPELINE_USER_AGENT = 'IndLokal-ContentBot/1.0 (+https://indlokal.de)';

export const PIPELINE_FETCH_TIMEOUT_MS = 15_000;
