/**
 * Coverage audit unit tests — PRD/TDD-0053 §3, §8.
 *
 * Mocks the composition boundary so coverage counting + grading are tested in
 * isolation. The key invariant: a row's verdict equals `meetsDensityGate` on
 * the same stages, so the report can never disagree with the engine.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyView, JourneyStageBlock, JourneyBlock, JourneyEntityKind } from '../types';

const composeMock = vi.fn();
vi.mock('../compose', () => ({
  composeJourney: (...args: unknown[]) => composeMock(...args),
}));

import { buildCoverageRow, computeCityCoverage } from '../coverage';
import { meetsDensityGate } from '../density';

// ── fixtures ────────────────────────────────────────────────────────────────

function block(kind: JourneyEntityKind, i: number): JourneyBlock {
  return {
    entityKind: kind,
    entityId: `${kind}-${i}`,
    title: `${kind} ${i}`,
    summary: null,
    badge: null,
    resolvedScope: null,
    action: { kind: 'open_link', label: 'View', href: '/x', external: false },
  };
}

function stage(
  name: JourneyStageBlock['stage'],
  index: number,
  counts: { resource?: number; community?: number; event?: number },
): JourneyStageBlock {
  const blocks: JourneyBlock[] = [];
  let i = 0;
  for (let r = 0; r < (counts.resource ?? 0); r += 1) blocks.push(block('resource', i++));
  for (let c = 0; c < (counts.community ?? 0); c += 1) blocks.push(block('community', i++));
  for (let e = 0; e < (counts.event ?? 0); e += 1) blocks.push(block('event', i++));
  return { stage: name, stageIndex: index, blocks };
}

function view(stages: JourneyStageBlock[], overrides: Partial<JourneyView> = {}): JourneyView {
  const blockCount = stages.reduce((sum, s) => sum + s.blocks.length, 0);
  return {
    persona: 'FAMILY',
    personaSlug: 'young-family',
    citySlug: 'stuttgart',
    cityName: 'Stuttgart',
    language: 'en',
    promoted: meetsDensityGate(stages),
    stages,
    blockCount,
    ...overrides,
  };
}

beforeEach(() => {
  composeMock.mockReset();
});

// ── counting ─────────────────────────────────────────────────────────────────

describe('buildCoverageRow — counting', () => {
  it('buckets blocks per stage by entity kind', () => {
    const row = buildCoverageRow(
      view([
        stage('PRE_ARRIVAL', 0, { resource: 2 }),
        stage('FIRST_30_DAYS', 1, { resource: 1, community: 2, event: 1 }),
      ]),
    );

    const pre = row.cells.find((c) => c.stage === 'PRE_ARRIVAL')!;
    expect(pre.resourceCount).toBe(2);
    expect(pre.total).toBe(2);

    const d30 = row.cells.find((c) => c.stage === 'FIRST_30_DAYS')!;
    expect(d30.resourceCount).toBe(1);
    expect(d30.communityCount).toBe(2);
    expect(d30.eventCount).toBe(1);
    expect(d30.total).toBe(4);
  });

  it('emits a cell for every canonical stage, even empty ones', () => {
    const row = buildCoverageRow(view([stage('PRE_ARRIVAL', 0, { resource: 1 })]));
    expect(row.cells).toHaveLength(5);
    const settled = row.cells.find((c) => c.stage === 'SETTLED')!;
    expect(settled.total).toBe(0);
  });
});

// ── verdict parity with the engine gate ──────────────────────────────────────

describe('buildCoverageRow — verdict matches density gate', () => {
  it('READY at the exact density boundary (2 + 2 + 2 across required stages)', () => {
    const stages = [
      stage('PRE_ARRIVAL', 0, { resource: 2 }),
      stage('FIRST_30_DAYS', 1, { resource: 2 }),
      stage('FIRST_90_DAYS', 2, { resource: 2 }),
    ];
    expect(meetsDensityGate(stages)).toBe(true);
    expect(buildCoverageRow(view(stages)).verdict).toBe('READY');
  });

  it('THIN when a required stage is missing', () => {
    const stages = [
      stage('PRE_ARRIVAL', 0, { resource: 3 }),
      stage('FIRST_90_DAYS', 2, { resource: 3 }),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
    const row = buildCoverageRow(view(stages));
    expect(row.verdict).toBe('THIN');
    expect(row.gaps).toContain('young-family/FIRST_30_DAYS missing (required)');
  });

  it('THIN when a non-empty stage has only one block', () => {
    const stages = [
      stage('PRE_ARRIVAL', 0, { resource: 2 }),
      stage('FIRST_30_DAYS', 1, { resource: 1 }),
      stage('FIRST_90_DAYS', 2, { resource: 2 }),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
    const row = buildCoverageRow(view(stages));
    expect(row.verdict).toBe('THIN');
    expect(row.gaps).toContain('young-family/FIRST_30_DAYS has 1 (<2)');
  });

  it('THIN when total blocks fall below the minimum', () => {
    const stages = [
      stage('PRE_ARRIVAL', 0, { resource: 2 }),
      stage('FIRST_30_DAYS', 1, { resource: 2 }),
    ];
    expect(meetsDensityGate(stages)).toBe(false);
    const row = buildCoverageRow(view(stages));
    expect(row.gaps.some((g) => g.includes('total 4 (<6)'))).toBe(true);
  });
});

// ── city aggregation ─────────────────────────────────────────────────────────

describe('computeCityCoverage', () => {
  it('composes every persona and counts READY rows', async () => {
    const ready = view([
      stage('PRE_ARRIVAL', 0, { resource: 2 }),
      stage('FIRST_30_DAYS', 1, { resource: 2 }),
      stage('FIRST_90_DAYS', 2, { resource: 2 }),
    ]);
    const thin = view([stage('PRE_ARRIVAL', 0, { resource: 1 })]);
    composeMock.mockResolvedValueOnce(ready).mockResolvedValueOnce(thin);

    const report = await computeCityCoverage({
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
      personas: ['FAMILY', 'STUDENT'],
    });

    expect(composeMock).toHaveBeenCalledTimes(2);
    expect(report.personaCount).toBe(2);
    expect(report.readyCount).toBe(1);
    expect(report.rows[0].verdict).toBe('READY');
    expect(report.rows[1].verdict).toBe('THIN');
  });
});
