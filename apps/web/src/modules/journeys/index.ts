/**
 * Journeys Module — PRD/TDD-0052, ADR-0011.
 *
 * The Journey Layer is a *composition* over existing tagged data (resources,
 * communities, events), not a new content type. It shapes that data into a
 * stage-ordered, action-ending experience selected by persona.
 *
 * Public surface:
 *  - composeJourney()        orchestration entry point
 *  - persona registry        getPersonaDefinition / getPersonaBySlug / PERSONA_DEFINITIONS
 *  - stage metadata          STAGE_ORDER / STAGE_META
 *  - density gate            meetsDensityGate
 */
export { composeJourney } from './compose';
export {
  PERSONA_DEFINITIONS,
  getPersonaDefinition,
  getPersonaBySlug,
  type PersonaDefinition,
} from './personas';
export { STAGE_ORDER, STAGE_INDEX, STAGE_META } from './stages';
export { meetsDensityGate, MIN_BLOCKS_PER_STAGE, MIN_TOTAL_BLOCKS } from './density';
export { resolveResourceAction, resolveCommunityAction, resolveEventAction } from './actions';
export {
  computeCityCoverage,
  buildCoverageRow,
  type CoverageVerdict,
  type CoverageCell,
  type CoverageRow,
  type CityCoverageReport,
} from './coverage';
export {
  ingestJourneyGapBacklog,
  assignJourneyGapItem,
  setJourneyGapSla,
  resolveJourneyGapItem,
  priorityBandForJourneyGap,
} from './ops-backlog';
export type {
  JourneyPersona,
  JourneyView,
  JourneyBlock,
  JourneyStageBlock,
  JourneyActionDescriptor,
  JourneyEntityKind,
  JourneyActionKind,
  ComposeJourneyInput,
} from './types';
