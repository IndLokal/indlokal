/**
 * Minimum-density gate — PRD/TDD-0052 §6, ADR-0011 §5.
 *
 * A journey is only *promoted* (advertised as an entry point on the landing
 * and city feed) when it is dense enough to feel complete. A sparse journey
 * still renders if reached directly, but is never surfaced as a teaser.
 *
 * Promote when ALL hold:
 *   1. every non-empty stage has ≥ MIN_BLOCKS_PER_STAGE blocks
 *   2. the journey has ≥ MIN_TOTAL_BLOCKS blocks total
 *   3. both PRE_ARRIVAL and FIRST_30_DAYS are non-empty (the early stages
 *      carry the most newcomer value, so they must be present)
 */
import type { JourneyStageBlock, ResourceStage } from './types';

export const MIN_BLOCKS_PER_STAGE = 2;
export const MIN_TOTAL_BLOCKS = 6;
export const REQUIRED_STAGES: readonly ResourceStage[] = ['PRE_ARRIVAL', 'FIRST_30_DAYS'];

export function meetsDensityGate(stages: JourneyStageBlock[]): boolean {
  const nonEmpty = stages.filter((s) => s.blocks.length > 0);

  const everyStageDenseEnough = nonEmpty.every((s) => s.blocks.length >= MIN_BLOCKS_PER_STAGE);
  if (!everyStageDenseEnough) return false;

  const total = nonEmpty.reduce((sum, s) => sum + s.blocks.length, 0);
  if (total < MIN_TOTAL_BLOCKS) return false;

  const presentStages = new Set(nonEmpty.map((s) => s.stage));
  return REQUIRED_STAGES.every((stage) => presentStages.has(stage));
}
