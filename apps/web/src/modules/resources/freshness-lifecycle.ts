export type ResourceFreshnessState =
  | 'IN_TTL'
  | 'STALE_DEMOTED'
  | 'PROLONGED_STALE'
  | 'HIDDEN_ARCHIVED';

export interface ResourceFreshnessProjection {
  state: ResourceFreshnessState;
  stateLabel: 'In TTL' | 'Needs Review' | 'Prolonged Stale' | 'Hidden/Archived';
  ttlDueAt: Date | null;
  staleSinceAt: Date | null;
  lifecycleReason: string;
  shouldDemote: boolean;
  shouldHide: boolean;
  demotionPenalty: number;
}

function addDays(input: Date, days: number): Date {
  return new Date(input.getTime() + days * 24 * 60 * 60 * 1000);
}

function toObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

export function evaluateResourceFreshness(input: {
  isHidden: boolean;
  hiddenReason: string | null;
  lastReviewedAt: Date | null;
  reviewCadenceDays: number;
  isEssential: boolean;
  lifecycleStage: string[];
  metadata: unknown;
  now?: Date;
}): ResourceFreshnessProjection {
  const now = input.now ?? new Date();
  const metadata = toObject(input.metadata);
  const freshnessConfig = toObject(metadata?.freshness);
  const manualLock = freshnessConfig?.manualLock === true;
  const allowAutoHide = freshnessConfig?.allowAutoHide === true;
  const journeyCritical =
    input.isEssential ||
    input.lifecycleStage.includes('PRE_ARRIVAL') ||
    input.lifecycleStage.includes('FIRST_30_DAYS');

  if (input.isHidden) {
    return {
      state: 'HIDDEN_ARCHIVED',
      stateLabel: 'Hidden/Archived',
      ttlDueAt: null,
      staleSinceAt: null,
      lifecycleReason: input.hiddenReason ?? 'Hidden by admin',
      shouldDemote: true,
      shouldHide: true,
      demotionPenalty: 100,
    };
  }

  if (!input.lastReviewedAt) {
    return {
      state: 'STALE_DEMOTED',
      stateLabel: 'Needs Review',
      ttlDueAt: null,
      staleSinceAt: null,
      lifecycleReason: 'No review timestamp available',
      shouldDemote: true,
      shouldHide: false,
      demotionPenalty: 20,
    };
  }

  const ttlDueAt = addDays(input.lastReviewedAt, input.reviewCadenceDays);
  if (now.getTime() <= ttlDueAt.getTime()) {
    return {
      state: 'IN_TTL',
      stateLabel: 'In TTL',
      ttlDueAt,
      staleSinceAt: null,
      lifecycleReason: 'Within review cadence',
      shouldDemote: false,
      shouldHide: false,
      demotionPenalty: 0,
    };
  }

  const staleSinceAt = ttlDueAt;
  const staleDays = Math.floor((now.getTime() - staleSinceAt.getTime()) / (24 * 60 * 60 * 1000));
  const prolongedThresholdDays = Math.max(30, input.reviewCadenceDays);
  const isProlonged = staleDays >= prolongedThresholdDays;
  const canAutoHide = isProlonged && allowAutoHide && !journeyCritical && !manualLock;

  if (canAutoHide) {
    return {
      state: 'HIDDEN_ARCHIVED',
      stateLabel: 'Hidden/Archived',
      ttlDueAt,
      staleSinceAt,
      lifecycleReason: 'Prolonged stale with auto-hide guardrails satisfied',
      shouldDemote: true,
      shouldHide: true,
      demotionPenalty: 100,
    };
  }

  if (isProlonged) {
    return {
      state: 'PROLONGED_STALE',
      stateLabel: 'Prolonged Stale',
      ttlDueAt,
      staleSinceAt,
      lifecycleReason: manualLock
        ? 'Prolonged stale but retained by manual lock'
        : journeyCritical
          ? 'Prolonged stale but retained as journey-critical'
          : 'Prolonged stale pending archival decision',
      shouldDemote: true,
      shouldHide: false,
      demotionPenalty: 40,
    };
  }

  return {
    state: 'STALE_DEMOTED',
    stateLabel: 'Needs Review',
    ttlDueAt,
    staleSinceAt,
    lifecycleReason: 'TTL exceeded; demoted pending re-verification',
    shouldDemote: true,
    shouldHide: false,
    demotionPenalty: 20,
  };
}
