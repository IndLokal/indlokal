import type { JourneyResourceStage, RuntimeLaneKeywordSeeds } from './runtime-config';
import type { SearchStrategy } from './types';

const RESOURCE_JOURNEY_STAGE_ORDER: JourneyResourceStage[] = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function quoteGoogleKeyword(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${trimmed}"`;
}

function renderGoogleKeywordQueries(keywords: string[]): string[] {
  const groupSize = 3;
  const rendered: string[] = [];

  for (let index = 0; index < keywords.length; index += groupSize) {
    const group = keywords.slice(index, index + groupSize).map(quoteGoogleKeyword);
    if (group.length > 0) rendered.push(group.join(' OR '));
  }

  return rendered;
}

export function renderKeywordsForSource(
  sourceType: SearchStrategy['sourceType'],
  keywords: string[],
): string[] {
  if (sourceType === 'GOOGLE_SEARCH') {
    return renderGoogleKeywordQueries(keywords);
  }

  return keywords;
}

export function getAdminResourceJourneyKeywords(
  triggeredBy: string,
  laneKeywordSeeds: RuntimeLaneKeywordSeeds | null,
): string[] {
  if (triggeredBy !== 'admin' || !laneKeywordSeeds) return [];

  return unique(
    RESOURCE_JOURNEY_STAGE_ORDER.flatMap(
      (stage) => laneKeywordSeeds.journeyResourceByStage[stage] ?? [],
    ),
  );
}
