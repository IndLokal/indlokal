/**
 * Journey composition — PRD/TDD-0052 §5, ADR-0011.
 *
 * `composeJourney` turns a (persona, city) pair into a stage-ordered,
 * action-ending `JourneyView` by composing over EXISTING tagged data:
 *
 *   resources (by audience × lifecycle stage)
 *     + communities (by personaSegment)
 *     + events (upcoming, published)
 *
 * It is deterministic and rule-based (no ML, ADR-0011 §2). The only data it
 * reads comes through the resource/community/event module boundaries, so it is
 * unit-testable by mocking those three functions.
 */
import { getResourcesForCity, type ResolvedResource } from '@/modules/resources';
import { getCommunitiesForPersona, type JourneyCommunityRow } from '@/modules/community';
import { getUpcomingEvents, type EventListItem } from '@/modules/event';
import { getPersonaDefinition } from './personas';
import { resolveResourceAction, resolveCommunityAction, resolveEventAction } from './actions';
import { meetsDensityGate } from './density';
import { STAGE_ORDER, STAGE_INDEX } from './stages';
import type {
  ComposeJourneyInput,
  JourneyBlock,
  JourneyStageBlock,
  JourneyView,
  ResourceStage,
} from './types';

/** Communities and events live in the "find your people / get involved" phase. */
const COMMUNITY_STAGE: ResourceStage = 'FIRST_90_DAYS';
const EVENT_STAGE: ResourceStage = 'FIRST_90_DAYS';

const MAX_RESOURCES = 24;
const MAX_COMMUNITIES = 8;
const MAX_EVENTS = 6;
const MAX_BLOCKS_PER_STAGE = 8;

/** A block plus the keys used to order it within a stage (stripped before output). */
interface ScoredBlock {
  stage: ResourceStage;
  /** Higher sorts first. */
  rank: number;
  block: JourneyBlock;
}

/** Earliest lifecycle stage a resource targets, or ANYTIME when untagged. */
function resourceStage(resource: ResolvedResource): ResourceStage {
  if (resource.lifecycleStage.length === 0) return 'ANYTIME';
  return [...resource.lifecycleStage].sort((a, b) => STAGE_INDEX[a] - STAGE_INDEX[b])[0];
}

function resourceBlock(resource: ResolvedResource, citySlug: string): ScoredBlock {
  return {
    stage: resourceStage(resource),
    // Essentials lead, then explicit priority. Offset keeps resources above
    // communities/events when they share a stage.
    rank: 2000 + (resource.isEssential ? 1000 : 0) + resource.priority,
    block: {
      entityKind: 'resource',
      entityId: resource.id,
      title: resource.title,
      summary: resource.description,
      badge: resource.isEssential ? 'Essential' : null,
      resolvedScope: resource.resolvedScope,
      action: resolveResourceAction(resource, citySlug),
    },
  };
}

function communityBlock(community: JourneyCommunityRow, citySlug: string): ScoredBlock | null {
  const action = resolveCommunityAction(community, citySlug);
  if (!action) return null; // action-or-drop: no joinable channel
  return {
    stage: COMMUNITY_STAGE,
    rank: 1000 + Math.round(community.trustScore),
    block: {
      entityKind: 'community',
      entityId: community.id,
      title: community.name,
      summary: community.description,
      badge: community.claimState === 'CLAIMED' ? 'Verified community' : 'Community',
      resolvedScope: null,
      action,
    },
  };
}

function eventBlock(event: EventListItem, citySlug: string, index: number): ScoredBlock {
  return {
    stage: EVENT_STAGE,
    // Soonest events first (events arrive sorted by startsAt asc).
    rank: 500 - index,
    block: {
      entityKind: 'event',
      entityId: event.id,
      title: event.title,
      summary: event.venueName ?? (event.isOnline ? 'Online event' : null),
      badge: 'Upcoming event',
      resolvedScope: null,
      action: resolveEventAction(event, citySlug),
    },
  };
}

/**
 * Compose a full journey for a persona in a city.
 *
 * Steps:
 *  1. Resolve persona → audiences + personaSegments.
 *  2. Gather resources (union over audiences, dedup by id), communities, events.
 *  3. Build blocks, applying the action-or-drop rule.
 *  4. Bucket by canonical stage, order within stage, cap, collapse empties.
 *  5. Evaluate the density gate → `promoted`.
 */
export async function composeJourney(input: ComposeJourneyInput): Promise<JourneyView> {
  const def = getPersonaDefinition(input.persona);
  const { citySlug } = input;

  // ── 1+2. Gather candidate data ──────────────────────────────────────────
  const resourceResults = await Promise.all(
    def.audiences.map((audience) =>
      // For ANYTIME, don't pass stage filter to getResourcesForCity so untagged
      // resources (which resourceStage() treats as ANYTIME) are included.
      // For other stages, pass the stage filter to get only explicitly tagged resources.
      getResourcesForCity(citySlug, {
        audience,
        ...(input.stage && input.stage !== 'ANYTIME' && { stage: input.stage }),
      }),
    ),
  );
  const dedupResources = new Map<string, ResolvedResource>();
  for (const list of resourceResults) {
    for (const r of list) if (!dedupResources.has(r.id)) dedupResources.set(r.id, r);
  }
  const resources = [...dedupResources.values()].slice(0, MAX_RESOURCES);

  const [communities, events] = await Promise.all([
    def.personaSegments.length > 0
      ? getCommunitiesForPersona(citySlug, def.personaSegments, { limit: MAX_COMMUNITIES })
      : Promise.resolve<JourneyCommunityRow[]>([]),
    getUpcomingEvents(citySlug, { limit: MAX_EVENTS }),
  ]);

  // ── 3. Build blocks (action-or-drop) ─────────────────────────────────────
  const scored: ScoredBlock[] = [];
  for (const r of resources) scored.push(resourceBlock(r, citySlug));
  for (const c of communities) {
    const block = communityBlock(c, citySlug);
    if (block) scored.push(block);
  }
  events.forEach((e, i) => scored.push(eventBlock(e, citySlug, i)));

  // ── 4. Bucket, order, cap, collapse ──────────────────────────────────────
  const stagesToRender = input.stage ? [input.stage] : STAGE_ORDER;
  const stages: JourneyStageBlock[] = [];
  let blockCount = 0;

  for (const stage of stagesToRender) {
    const inStage = scored
      .filter((s) => s.stage === stage)
      .sort((a, b) => b.rank - a.rank || a.block.title.localeCompare(b.block.title))
      .slice(0, MAX_BLOCKS_PER_STAGE)
      .map((s) => s.block);

    if (inStage.length === 0) continue; // collapse empty stages
    stages.push({ stage, stageIndex: STAGE_INDEX[stage], blocks: inStage });
    blockCount += inStage.length;
  }

  // ── 5. Density gate ───────────────────────────────────────────────────────
  const promoted = !input.stage && meetsDensityGate(stages);

  return {
    persona: input.persona,
    personaSlug: def.slug,
    citySlug,
    cityName: input.cityName,
    language: input.language ?? 'en',
    promoted,
    stages,
    blockCount,
  };
}
