/**
 * composeJourney unit tests — PRD/TDD-0052 §5.
 *
 * Mocks the resource / community / event module boundaries so composition is
 * tested in isolation (no DB). Verifies the action-or-drop invariant, stage
 * bucketing + ordering, resource dedup, the density gate, and stage filtering.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedResource } from '@/modules/resources';
import type { JourneyCommunityRow } from '@/modules/community';
import type { EventListItem } from '@/modules/event';

const resourcesMock = vi.fn();
const communitiesMock = vi.fn();
const eventsMock = vi.fn();

vi.mock('@/modules/resources', () => ({
  getResourcesForCity: (...args: unknown[]) => resourcesMock(...args),
}));
vi.mock('@/modules/community', () => ({
  getCommunitiesForPersona: (...args: unknown[]) => communitiesMock(...args),
}));
vi.mock('@/modules/event', () => ({
  getUpcomingEvents: (...args: unknown[]) => eventsMock(...args),
}));

import { composeJourney } from '../compose';

// ── factories ──────────────────────────────────────────────────────────────

let idSeq = 0;
function resource(overrides: Partial<ResolvedResource> = {}): ResolvedResource {
  idSeq += 1;
  return {
    id: `res_${idSeq}`,
    title: `Resource ${idSeq}`,
    slug: `resource-${idSeq}`,
    resourceType: 'CITY_REGISTRATION',
    url: null,
    description: 'desc',
    validFrom: null,
    validUntil: null,
    metadata: null,
    createdAt: new Date(0),
    scope: 'COUNTRY',
    scopeRegion: 'DE',
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
    priority: 50,
    isEssential: false,
    resolvedScope: 'COUNTRY',
    ...overrides,
  };
}

function community(overrides: Partial<JourneyCommunityRow> = {}): JourneyCommunityRow {
  idSeq += 1;
  return {
    id: `com_${idSeq}`,
    name: `Community ${idSeq}`,
    slug: `community-${idSeq}`,
    description: 'a group',
    personaSegments: ['family'],
    languages: ['Hindi'],
    claimState: 'CLAIMED',
    status: 'ACTIVE',
    trustScore: 50,
    activityScore: 10,
    city: { name: 'Stuttgart', slug: 'stuttgart' },
    accessChannels: [
      { channelType: 'WHATSAPP', url: 'https://chat.example/x', label: null, isPrimary: true },
    ],
    ...overrides,
  };
}

function event(overrides: Partial<EventListItem> = {}): EventListItem {
  idSeq += 1;
  return {
    id: `evt_${idSeq}`,
    title: `Event ${idSeq}`,
    slug: `event-${idSeq}`,
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: null,
    venueName: 'Hall',
    isOnline: false,
    cost: 'free',
    imageUrl: null,
    isRecurring: false,
    community: null,
    city: { name: 'Stuttgart', slug: 'stuttgart' },
    categories: [],
    ...overrides,
  } as EventListItem;
}

beforeEach(() => {
  idSeq = 0;
  resourcesMock.mockReset().mockResolvedValue([]);
  communitiesMock.mockReset().mockResolvedValue([]);
  eventsMock.mockReset().mockResolvedValue([]);
});

const base = { citySlug: 'stuttgart', cityName: 'Stuttgart' };

describe('composeJourney — action-or-drop', () => {
  it('drops a community with no access channel and keeps one with a channel', async () => {
    communitiesMock.mockResolvedValue([community({ accessChannels: [] }), community()]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    const communityBlocks = view.stages
      .flatMap((s) => s.blocks)
      .filter((b) => b.entityKind === 'community');

    expect(communityBlocks).toHaveLength(1);
    expect(communityBlocks[0].action.kind).toBe('join');
    expect(communityBlocks[0].action.href).toContain('/communities/');
  });

  it('every emitted block has a non-null action', async () => {
    resourcesMock.mockResolvedValue([resource(), resource({ lifecycleStage: ['PRE_ARRIVAL'] })]);
    communitiesMock.mockResolvedValue([community()]);
    eventsMock.mockResolvedValue([event()]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    for (const block of view.stages.flatMap((s) => s.blocks)) {
      expect(block.action).toBeTruthy();
      expect(block.action.label.length).toBeGreaterThan(0);
    }
  });
});

describe('composeJourney — bucketing & ordering', () => {
  it('places resources in their earliest lifecycle stage', async () => {
    resourcesMock.mockResolvedValue([
      resource({ slug: 'late', lifecycleStage: ['SETTLED', 'PRE_ARRIVAL'] }),
    ]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    const preArrival = view.stages.find((s) => s.stage === 'PRE_ARRIVAL');
    expect(preArrival?.blocks.some((b) => b.title.includes('Resource'))).toBe(true);
    expect(view.stages.find((s) => s.stage === 'SETTLED')).toBeUndefined();
  });

  it('orders essentials before non-essentials within a stage', async () => {
    resourcesMock.mockResolvedValue([
      resource({ title: 'Regular', isEssential: false, priority: 90 }),
      resource({ title: 'Essential', isEssential: true, priority: 10 }),
    ]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    const stage = view.stages.find((s) => s.stage === 'FIRST_30_DAYS');
    expect(stage?.blocks[0].title).toBe('Essential');
  });

  it('buckets communities and events into FIRST_90_DAYS', async () => {
    communitiesMock.mockResolvedValue([community()]);
    eventsMock.mockResolvedValue([event()]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    const stage = view.stages.find((s) => s.stage === 'FIRST_90_DAYS');
    const kinds = stage?.blocks.map((b) => b.entityKind) ?? [];
    expect(kinds).toContain('community');
    expect(kinds).toContain('event');
  });

  it('collapses empty stages', async () => {
    resourcesMock.mockResolvedValue([resource({ lifecycleStage: ['PRE_ARRIVAL'] })]);
    const view = await composeJourney({ persona: 'FAMILY', ...base });
    expect(view.stages.every((s) => s.blocks.length > 0)).toBe(true);
  });
});

describe('composeJourney — dedup & density', () => {
  it('dedups resources returned for multiple audiences', async () => {
    const shared = resource({ id: 'dup_1', slug: 'dup' });
    // SKILLED_WORKER unions NEWCOMER + EMPLOYEE → two resolver calls.
    resourcesMock.mockResolvedValue([shared]);

    const view = await composeJourney({ persona: 'SKILLED_WORKER', ...base });
    const matching = view.stages.flatMap((s) => s.blocks).filter((b) => b.entityId === 'dup_1');
    expect(matching).toHaveLength(1);
  });

  it('promotes a dense journey and reports blockCount', async () => {
    resourcesMock.mockResolvedValue([
      resource({ lifecycleStage: ['PRE_ARRIVAL'] }),
      resource({ lifecycleStage: ['PRE_ARRIVAL'] }),
      resource({ lifecycleStage: ['FIRST_30_DAYS'] }),
      resource({ lifecycleStage: ['FIRST_30_DAYS'] }),
    ]);
    communitiesMock.mockResolvedValue([community(), community()]);

    const view = await composeJourney({ persona: 'FAMILY', ...base });
    expect(view.promoted).toBe(true);
    expect(view.blockCount).toBe(6);
  });

  it('does not promote a sparse journey', async () => {
    resourcesMock.mockResolvedValue([resource({ lifecycleStage: ['PRE_ARRIVAL'] })]);
    const view = await composeJourney({ persona: 'FAMILY', ...base });
    expect(view.promoted).toBe(false);
  });

  it('never promotes when a single-stage filter is applied', async () => {
    resourcesMock.mockResolvedValue([
      resource({ lifecycleStage: ['FIRST_30_DAYS'] }),
      resource({ lifecycleStage: ['FIRST_30_DAYS'] }),
    ]);
    const view = await composeJourney({ persona: 'FAMILY', ...base, stage: 'FIRST_30_DAYS' });
    expect(view.promoted).toBe(false);
    expect(view.stages.every((s) => s.stage === 'FIRST_30_DAYS')).toBe(true);
  });
});

describe('composeJourney — shape', () => {
  it('returns persona metadata and city name', async () => {
    const view = await composeJourney({ persona: 'FAMILY', ...base });
    expect(view.persona).toBe('FAMILY');
    expect(view.personaSlug).toBe('young-family');
    expect(view.cityName).toBe('Stuttgart');
    expect(view.language).toBe('en');
  });
});
