/**
 * Canonical journey stage ordering + display metadata (PRD/TDD-0052).
 * Mirrors `ResourceStage` from the shared contract.
 */
import type { ResourceStage } from './types';

export const STAGE_ORDER: readonly ResourceStage[] = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
];

export const STAGE_INDEX: Record<ResourceStage, number> = {
  PRE_ARRIVAL: 0,
  FIRST_30_DAYS: 1,
  FIRST_90_DAYS: 2,
  SETTLED: 3,
  ANYTIME: 4,
};

export const STAGE_META: Record<ResourceStage, { label: string; blurb: string }> = {
  PRE_ARRIVAL: {
    label: 'Before you arrive',
    blurb: 'Visas, paperwork and decisions to make from India.',
  },
  FIRST_30_DAYS: {
    label: 'First 30 days',
    blurb: 'Registration, insurance and the essentials that unlock everything else.',
  },
  FIRST_90_DAYS: {
    label: 'First 90 days',
    blurb: 'Settling in — childcare, doctors and finding your people.',
  },
  SETTLED: {
    label: 'Settling in',
    blurb: 'Schools, longer-term admin and building a life here.',
  },
  ANYTIME: {
    label: 'Anytime',
    blurb: 'Good to know whenever you need it.',
  },
};
