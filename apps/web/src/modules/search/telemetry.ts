import { recordInteraction } from '@/modules/engagement';

export type SearchScope = 'city' | 'national';
export type SearchEntityFilter = 'COMMUNITY' | 'EVENT' | 'RESOURCE' | 'ALL';

export interface SearchTelemetryInput {
  userId: string | null;
  query: string;
  scope: SearchScope;
  entityFilter: SearchEntityFilter;
  resultsCount: number;
  cityId?: string | null;
}

/**
 * Persist a search-query signal (PRD/TDD-0048). Reuses the existing
 * `UserInteraction(SEARCH)` channel: the structured payload lives in metadata
 * and `entityId` carries a truncated, lowercased query so the zero-result rate
 * is queryable without a schema change.
 *
 * Fire-and-forget — never blocks rendering (mirrors recordInteraction).
 */
export async function recordSearchInteraction(input: SearchTelemetryInput): Promise<void> {
  const normalizedQuery = input.query.trim().toLowerCase().slice(0, 120);
  if (normalizedQuery.length < 2) return;

  await recordInteraction({
    userId: input.userId,
    // No dedicated SEARCH entity type exists; COMMUNITY is the documented
    // sentinel (TDD-0048). The query payload lives in metadata.
    entityType: 'COMMUNITY',
    entityId: normalizedQuery,
    interactionType: 'SEARCH',
    cityId: input.cityId ?? null,
    metadata: {
      kind: 'search',
      query: input.query.trim().slice(0, 200),
      scope: input.scope,
      entityFilter: input.entityFilter,
      resultsCount: input.resultsCount,
      hasResults: input.resultsCount > 0,
    },
  });
}
