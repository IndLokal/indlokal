export type JourneyActionCandidate = {
  id: string;
  title: string;
  href: string;
  stage?: string;
};

const JOURNEY_PROGRESS_PREFIX = 'resource_journey:v1:';

export function getJourneyProgressStorageKey(citySlug: string): string {
  return `${JOURNEY_PROGRESS_PREFIX}${citySlug}`;
}

export function parseJourneyProgress(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter((value): value is string => typeof value === 'string');
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function serializeJourneyProgress(progress: Set<string>): string {
  return JSON.stringify(Array.from(progress));
}

export function selectNextJourneyAction(
  candidates: JourneyActionCandidate[],
  checked: Set<string>,
): JourneyActionCandidate | null {
  for (const candidate of candidates) {
    if (!checked.has(candidate.id)) return candidate;
  }
  return null;
}
