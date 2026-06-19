import type {
  JourneyResourceStage,
  KeywordStrategyTemplate,
  RuntimeLaneKeywordSeeds,
} from './runtime-config';
import type { SearchStrategy, SourceLane } from './types';

type GapKeywordCity = {
  slug: string;
  name: string;
};

const EVENT_GAP_TEMPLATES = [
  'Indian event {city}',
  'Indian meetup {city}',
  'South Asian festival {city}',
  'indische Veranstaltung {city}',
] as const;

const COMMUNITY_GAP_TEMPLATES = [
  'Indian community group {city}',
  'South Asian community {city}',
  'Indian student group {city}',
  'Indian professionals network {city}',
  'indische Community {city}',
  'indischer Verein {city}',
] as const;

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

/**
 * Google Custom Search is more predictable with quoted exact-phrase queries.
 * Leave already-quoted inputs untouched so caller-provided formatting survives.
 */
function quoteGoogleKeyword(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${trimmed}"`;
}

/**
 * Batch Google keywords into OR groups so one search request can probe a few
 * closely related phrases without exploding query count.
 */
function renderGoogleKeywordQueries(keywords: string[]): string[] {
  const groupSize = 3;
  const rendered: string[] = [];

  for (let index = 0; index < keywords.length; index += groupSize) {
    const group = keywords.slice(index, index + groupSize).map(quoteGoogleKeyword);
    if (group.length > 0) rendered.push(group.join(' OR '));
  }

  return rendered;
}

function expandTemplates(templates: readonly string[], cities: GapKeywordCity[]): string[] {
  return unique(
    cities.flatMap((city) => templates.map((template) => template.replace('{city}', city.name))),
  );
}

/**
 * Community discovery should still run in event-starved cities, so merge both
 * gap lists before expanding community templates.
 */
function getUnionGapCities(
  eventGaps: GapKeywordCity[],
  communityGaps: GapKeywordCity[],
): GapKeywordCity[] {
  return [...new Set([...eventGaps, ...communityGaps].map((gap) => gap.slug))]
    .map(
      (slug) =>
        eventGaps.find((gap) => gap.slug === slug) ||
        communityGaps.find((gap) => gap.slug === slug),
    )
    .filter((gap): gap is GapKeywordCity => Boolean(gap));
}

/**
 * Render final source-specific keyword queries.
 * Only Google Search needs batching; other sources consume plain keywords.
 */
export function renderKeywordsForSource(
  sourceType: SearchStrategy['sourceType'],
  keywords: string[],
): string[] {
  if (sourceType === 'GOOGLE_SEARCH') {
    return renderGoogleKeywordQueries(keywords);
  }

  return keywords;
}

/**
 * Resource journey hints are only used for admin-triggered discovery runs.
 * Flatten stage-specific hints into a deduplicated keyword list in journey order.
 */
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

/**
 * Build lane-specific gap keyword pools once so the planner can stay focused on
 * strategy selection instead of template expansion details.
 */
export function buildGapKeywordsByLane(
  eventGaps: GapKeywordCity[],
  communityGaps: GapKeywordCity[],
  resourceGapKeywords: string[],
): Record<SourceLane, string[]> {
  return {
    EVENT: expandTemplates(EVENT_GAP_TEMPLATES, eventGaps),
    COMMUNITY: expandTemplates(
      COMMUNITY_GAP_TEMPLATES,
      getUnionGapCities(eventGaps, communityGaps),
    ),
    RESOURCE: resourceGapKeywords,
  };
}

/**
 * Select the prebuilt gap keywords that match the strategy lane.
 * Strategies without an explicit lane are ignored by the strict planner model.
 */
export function getGapKeywordsForStrategy(
  strategy: KeywordStrategyTemplate,
  gapKeywordsByLane: Record<SourceLane, string[]>,
): string[] {
  if (!strategy.lane) return [];
  return gapKeywordsByLane[strategy.lane] ?? [];
}
