import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONSULAR_RESOURCE_TYPES,
  filterConsularResources,
  groupConsularResources,
} from './consular';

type AnyResource = Parameters<typeof filterConsularResources>[0][number];

function res(partial: {
  id: string;
  title: string;
  resourceType: AnyResource['resourceType'];
  priority?: number;
}): AnyResource {
  return {
    id: partial.id,
    title: partial.title,
    slug: partial.title.toLowerCase().replace(/\s+/g, '-'),
    resourceType: partial.resourceType,
    url: null,
    description: null,
    validFrom: null,
    validUntil: null,
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    scope: 'CITY',
    scopeRegion: null,
    audiences: [],
    lifecycleStage: [],
    priority: partial.priority ?? 0,
    isEssential: false,
  } as AnyResource;
}

describe('resources/consular filter', () => {
  it('keeps only the four official types', () => {
    const all = [
      res({ id: '1', title: 'Consulate', resourceType: 'CONSULAR_SERVICE' }),
      res({ id: '2', title: 'Visa', resourceType: 'VISA_SERVICE' }),
      res({ id: '3', title: 'Housing', resourceType: 'HOUSING' }),
      res({ id: '4', title: 'Gov', resourceType: 'GOVERNMENT_INFO' }),
      res({ id: '5', title: 'Grocery', resourceType: 'GROCERY_FOOD' }),
    ];
    const kept = filterConsularResources(all);
    assert.equal(kept.length, 3);
    for (const r of kept) {
      assert.ok(CONSULAR_RESOURCE_TYPES.includes(r.resourceType));
    }
  });
});

describe('resources/consular grouping', () => {
  it('groups into ordered, labeled sections and drops empties', () => {
    const all = [
      res({ id: '1', title: 'B Visa', resourceType: 'VISA_SERVICE', priority: 1 }),
      res({ id: '2', title: 'A Visa', resourceType: 'VISA_SERVICE', priority: 5 }),
      res({ id: '3', title: 'Consulate', resourceType: 'CONSULAR_SERVICE' }),
      res({ id: '4', title: 'Housing', resourceType: 'HOUSING' }),
    ];
    const sections = groupConsularResources(all);
    assert.deepEqual(
      sections.map((s) => s.type),
      ['CONSULAR_SERVICE', 'VISA_SERVICE'],
    );
    // Visa section sorted by priority desc then title.
    assert.deepEqual(
      sections[1].resources.map((r) => r.title),
      ['A Visa', 'B Visa'],
    );
    assert.equal(sections[0].label, 'Consular Services');
  });

  it('returns an empty array when nothing matches', () => {
    const all = [res({ id: '1', title: 'Housing', resourceType: 'HOUSING' })];
    assert.deepEqual(groupConsularResources(all), []);
  });
});
