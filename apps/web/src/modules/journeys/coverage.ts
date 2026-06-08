/**
 * Journey coverage audit — PRD/TDD-0053 §3.
 *
 * A journey is only as good as the tag coverage underneath it. This module
 * grades, per city × persona × stage, how many journey-eligible components
 * exist and whether the result clears the PRD-0052 density gate.
 *
 * It computes coverage by running the **same composition path** the engine
 * uses (`composeJourney` + `meetsDensityGate`), so the report can never
 * diverge from what the journey would actually render — "READY" means exactly
 * "promotable" (TDD-0053 §3, §8).
 */
import { composeJourney } from './compose';
import {
  meetsDensityGate,
  MIN_BLOCKS_PER_STAGE,
  MIN_TOTAL_BLOCKS,
  REQUIRED_STAGES,
} from './density';
import { PERSONA_DEFINITIONS, getPersonaDefinition } from './personas';
import { STAGE_ORDER, STAGE_INDEX, STAGE_META } from './stages';
import type { JourneyPersona, JourneyView, ResourceStage } from './types';

export type CoverageVerdict = 'READY' | 'THIN';

/** Per-stage component counts for one persona. */
export interface CoverageCell {
  stage: ResourceStage;
  stageIndex: number;
  label: string;
  resourceCount: number;
  communityCount: number;
  eventCount: number;
  total: number;
}

/** One persona's coverage across all stages, graded against the density gate. */
export interface CoverageRow {
  persona: JourneyPersona;
  personaSlug: string;
  label: string;
  cells: CoverageCell[];
  blockCount: number;
  verdict: CoverageVerdict;
  /** Human-readable density-gate shortfalls, e.g. "young-family/SETTLED has 1 (<2)". */
  gaps: string[];
}

/** A city's full coverage report (one row per persona). */
export interface CityCoverageReport {
  citySlug: string;
  cityName: string;
  generatedAt: string;
  rows: CoverageRow[];
  personaCount: number;
  readyCount: number;
}

function emptyCell(stage: ResourceStage): CoverageCell {
  return {
    stage,
    stageIndex: STAGE_INDEX[stage],
    label: STAGE_META[stage].label,
    resourceCount: 0,
    communityCount: 0,
    eventCount: 0,
    total: 0,
  };
}

/** Density-gate shortfalls for a composed view (informational worklist input). */
function computeGaps(view: JourneyView): string[] {
  const gaps: string[] = [];
  const nonEmpty = view.stages.filter((s) => s.blocks.length > 0);
  const present = new Set(nonEmpty.map((s) => s.stage));

  for (const stage of REQUIRED_STAGES) {
    if (!present.has(stage)) gaps.push(`${view.personaSlug}/${stage} missing (required)`);
  }
  for (const s of nonEmpty) {
    if (s.blocks.length < MIN_BLOCKS_PER_STAGE) {
      gaps.push(`${view.personaSlug}/${s.stage} has ${s.blocks.length} (<${MIN_BLOCKS_PER_STAGE})`);
    }
  }
  const total = nonEmpty.reduce((sum, s) => sum + s.blocks.length, 0);
  if (total < MIN_TOTAL_BLOCKS) {
    gaps.push(`${view.personaSlug} total ${total} (<${MIN_TOTAL_BLOCKS})`);
  }
  return gaps;
}

/**
 * Grade a single composed journey view into a coverage row. Pure: the verdict
 * is `meetsDensityGate(view.stages)` so it matches the engine exactly.
 */
export function buildCoverageRow(view: JourneyView): CoverageRow {
  const cellByStage = new Map<ResourceStage, CoverageCell>(
    STAGE_ORDER.map((stage) => [stage, emptyCell(stage)]),
  );

  for (const stageBlock of view.stages) {
    const cell = cellByStage.get(stageBlock.stage);
    if (!cell) continue;
    for (const block of stageBlock.blocks) {
      if (block.entityKind === 'resource') cell.resourceCount += 1;
      else if (block.entityKind === 'community') cell.communityCount += 1;
      else if (block.entityKind === 'event') cell.eventCount += 1;
      cell.total += 1;
    }
  }

  return {
    persona: view.persona,
    personaSlug: view.personaSlug,
    label: getPersonaDefinition(view.persona).label,
    cells: STAGE_ORDER.map((stage) => cellByStage.get(stage)!),
    blockCount: view.blockCount,
    verdict: meetsDensityGate(view.stages) ? 'READY' : 'THIN',
    gaps: computeGaps(view),
  };
}

/**
 * Compose every persona's journey for a city and grade each against the
 * density gate. Reuses the live composition path (no parallel logic).
 */
export async function computeCityCoverage(input: {
  citySlug: string;
  cityName: string;
  personas?: JourneyPersona[];
}): Promise<CityCoverageReport> {
  const personas = input.personas ?? PERSONA_DEFINITIONS.map((p) => p.persona);

  const views = await Promise.all(
    personas.map((persona) =>
      composeJourney({ persona, citySlug: input.citySlug, cityName: input.cityName }),
    ),
  );

  const rows = views.map(buildCoverageRow);

  return {
    citySlug: input.citySlug,
    cityName: input.cityName,
    generatedAt: new Date().toISOString(),
    rows,
    personaCount: rows.length,
    readyCount: rows.filter((r) => r.verdict === 'READY').length,
  };
}
