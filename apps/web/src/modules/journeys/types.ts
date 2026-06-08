/**
 * Journey Layer — internal types (PRD/TDD-0052, ADR-0011).
 *
 * Re-exports the wire contract types from `@indlokal/shared` and adds the
 * module-internal composition input/output shapes.
 */
import type { journeys as j, resources as r } from '@indlokal/shared';

export type JourneyPersona = j.JourneyPersona;
export type JourneyView = j.JourneyView;
export type JourneyBlock = j.JourneyBlock;
export type JourneyStageBlock = j.JourneyStageBlock;
export type JourneyActionDescriptor = j.JourneyActionDescriptor;
export type JourneyEntityKind = j.JourneyEntityKind;
export type JourneyActionKind = j.JourneyActionKind;

export type ResourceAudience = r.ResourceAudience;
export type ResourceStage = r.ResourceStage;

/** Input to `composeJourney`. */
export interface ComposeJourneyInput {
  persona: JourneyPersona;
  citySlug: string;
  cityName: string;
  /** Optional single-stage filter (rarely used; full journey by default). */
  stage?: ResourceStage;
  language?: string;
}
