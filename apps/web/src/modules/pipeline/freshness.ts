/**
 * Event freshness heuristics — shared by orchestrator (pre-LLM stale-page
 * filter) and db-sources (event sub-page discovery scoring).
 *
 * Keep all event-page lexical and year-based signals in one module so a new
 * heuristic only needs to be added once.
 */

export const EVENT_PAGE_MARKERS =
  /event|veranstaltung|programm|kalender|calendar|activit|agenda|upcoming|termin|what.?s.?on|schedule/i;

export const STRONG_FRESH_MARKERS =
  /upcoming|next|calendar|kalender|schedule|termin|what.?s.?on|programme|programm/i;

export const STALE_EVENT_MARKERS =
  /past|archive|archiv|gallery|eventgallery|album|photo|foto|bericht|review|recap/i;

export const FRESH_EVENT_MARKERS = /upcoming|next|current|ongoing|neu|latest|new this year/i;

export function extractMentionedYears(input: string): number[] {
  return [...input.matchAll(/\b20\d{2}\b/g)]
    .map((match) => Number.parseInt(match[0], 10))
    .filter(Number.isFinite);
}

export function getYearSignalScore(input: string): number {
  const currentYear = new Date().getFullYear();
  const years = extractMentionedYears(input);

  if (years.length === 0) return 0;

  const newestYear = Math.max(...years);
  if (newestYear < currentYear) return -2;
  if (newestYear === currentYear) return 1;
  return 2;
}
