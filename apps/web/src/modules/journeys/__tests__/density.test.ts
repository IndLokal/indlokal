/**
 * Density gate unit tests — PRD/TDD-0052 §6.
 */
import { describe, expect, it } from 'vitest';
import { meetsDensityGate } from '../density';
import type { JourneyBlock, JourneyStageBlock, ResourceStage } from '../types';

function block(title: string): JourneyBlock {
  return {
    entityKind: 'resource',
    entityId: `r-${title}`,
    title,
    summary: null,
    badge: null,
    resolvedScope: null,
    action: { kind: 'open_link', label: 'Open', href: '/x', external: false },
  };
}

function stage(name: ResourceStage, count: number, index = 0): JourneyStageBlock {
  return {
    stage: name,
    stageIndex: index,
    blocks: Array.from({ length: count }, (_, i) => block(`${name}-${i}`)),
  };
}

describe('meetsDensityGate', () => {
  it('promotes a dense journey (every stage ≥2, total ≥6, early stages present)', () => {
    const stages = [
      stage('PRE_ARRIVAL', 2, 0),
      stage('FIRST_30_DAYS', 2, 1),
      stage('FIRST_90_DAYS', 2, 2),
    ];
    expect(meetsDensityGate(stages)).toBe(true);
  });

  it('rejects when a non-empty stage has only 1 block', () => {
    const stages = [
      stage('PRE_ARRIVAL', 2, 0),
      stage('FIRST_30_DAYS', 1, 1),
      stage('FIRST_90_DAYS', 3, 2),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
  });

  it('rejects when total blocks < 6', () => {
    const stages = [stage('PRE_ARRIVAL', 2, 0), stage('FIRST_30_DAYS', 2, 1)];
    expect(meetsDensityGate(stages)).toBe(false);
  });

  it('rejects when PRE_ARRIVAL is missing', () => {
    const stages = [
      stage('FIRST_30_DAYS', 3, 1),
      stage('FIRST_90_DAYS', 3, 2),
      stage('SETTLED', 2, 3),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
  });

  it('rejects when FIRST_30_DAYS is missing', () => {
    const stages = [
      stage('PRE_ARRIVAL', 3, 0),
      stage('FIRST_90_DAYS', 3, 2),
      stage('SETTLED', 2, 3),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
  });

  it('rejects an empty journey', () => {
    expect(meetsDensityGate([])).toBe(false);
  });
});
