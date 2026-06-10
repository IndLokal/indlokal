import {
  summarizeEvidence,
  type EvidenceQuality,
  type EvidenceSummary,
  type EvidenceTier,
} from './source-policy';

/**
 * Presentation-layer trust helpers for IndLokal communities.
 *
 * This module is the ONLY place that maps the deterministic evidence policy
 * ({@link summarizeEvidence}) onto user-facing badges. It adds no classification
 * logic of its own — see `docs/SOURCE_AND_EVIDENCE_POLICY.md` and PRD/TDD-0055.
 *
 * Honesty rule (enforced structurally): the word "Verified" is RESERVED for the
 * organization/claim axis. Evidence quality only ever describes SOURCE strength,
 * so the ladder is "Strong source -> Source-supported -> Insufficient" and never
 * borrows "Verified" for a source.
 */

/** Coarse visual tone shared by every evidence surface. */
export type EvidenceTone = 'strong' | 'supported' | 'insufficient';

/**
 * The SINGLE canonical vocabulary for evidence quality across every surface
 * (public cards, community detail, and all admin queues). Doc and code agree by
 * construction — see `docs/SOURCE_AND_EVIDENCE_POLICY.md` §17.
 */
export type EvidenceQualityDescriptor = {
  /** Dense table chip (one word). */
  shortLabel: string;
  /** Standard chip / public badge label. */
  label: string;
  tone: EvidenceTone;
  /** Long, honest sentence for tooltips/helper text. */
  description: string;
};

const EVIDENCE_QUALITY_DESCRIPTORS: Record<EvidenceQuality, EvidenceQualityDescriptor> = {
  verified_candidate: {
    shortLabel: 'Strong',
    label: 'Strong source',
    tone: 'strong',
    description:
      'Backed by a strong public source (an official register, government/consular page, institutional directory, or its own website). Still requires manual review before the organization itself is verified.',
  },
  source_supported: {
    shortLabel: 'Source',
    label: 'Source-supported',
    tone: 'supported',
    description:
      'Found on a public source (e.g. a social or map profile). Listable and discoverable, but not a verified organization.',
  },
  insufficient: {
    shortLabel: 'Insufficient',
    label: 'Insufficient evidence',
    tone: 'insufficient',
    description:
      'No usable public evidence yet. A strong or weak public source is needed before this listing can be trusted.',
  },
};

export type CommunityEvidenceBadgeKind = 'strong_source' | 'source_supported';

export type CommunityEvidenceBadge = {
  kind: CommunityEvidenceBadgeKind;
  /** Short chip label. */
  label: string;
  /** Long, honest reason for tooltips/helper text. */
  title: string;
  /** Underlying policy quality, for callers that want to branch further. */
  quality: EvidenceQuality;
};

/**
 * Map a set of public source URLs (typically a community's access-channel URLs)
 * to a single display badge.
 *
 * - Strong evidence  → `strong_source` ("Strong source")
 * - Weak public only → `source_supported` ("Source-supported")
 * - Insufficient     → `null` (render nothing)
 *
 * Pure and total: never throws (URL safety is handled by the policy).
 */
export function getCommunityEvidenceBadge(
  channelUrls: readonly string[],
): CommunityEvidenceBadge | null {
  return badgeFromSummary(summarizeEvidence(channelUrls));
}

/** Same mapping when the caller already has a computed {@link EvidenceSummary}. */
export function badgeFromSummary(summary: EvidenceSummary): CommunityEvidenceBadge | null {
  if (summary.hasStrongEvidence) {
    const descriptor = EVIDENCE_QUALITY_DESCRIPTORS.verified_candidate;
    return {
      kind: 'strong_source',
      label: descriptor.label,
      title: descriptor.description,
      quality: summary.quality,
    };
  }
  if (summary.hasPublicEvidence) {
    const descriptor = EVIDENCE_QUALITY_DESCRIPTORS.source_supported;
    return {
      kind: 'source_supported',
      label: descriptor.label,
      title: descriptor.description,
      quality: summary.quality,
    };
  }
  return null;
}

/**
 * Canonical persisted evidence record (PRD/TDD-0055).
 *
 * This is the SINGLE shape stored under `metadata.sourceEvidence` for a
 * community — written identically by the editorial seed, the web submission
 * action, and the mobile pipeline service, and produced by the backfill so
 * existing rows match. Keep this in sync with `scripts/backfill-community-evidence.ts`.
 */
export type StoredEvidenceRecord = {
  quality: EvidenceQuality;
  /** Highest confidence (0-100) across the assessed source URLs. */
  score: number;
  strongestTier: EvidenceTier | null;
  strongestLabel: string | null;
  /** Mirrors the policy's review gate for these sources. */
  requiresReview: boolean;
  /** Human-readable policy reason (for admin tooltips). */
  reason: string;
  /** ISO timestamp the record was computed. */
  assessedAt: string;
};

/**
 * Build the canonical {@link StoredEvidenceRecord} from a set of source URLs
 * (typically a community's access-channel URLs, or a seed `sourceUrl`).
 *
 * Pure except for the timestamp; pass `now` for deterministic tests.
 */
export function buildStoredEvidence(
  sourceUrls: readonly string[],
  options?: { now?: Date },
): StoredEvidenceRecord {
  const summary = summarizeEvidence(sourceUrls);
  return {
    quality: summary.quality,
    score: summary.score,
    strongestTier: summary.strongest?.tier ?? null,
    strongestLabel: summary.strongest?.label ?? null,
    requiresReview: summary.requiresReview,
    reason: summary.reviewReason,
    assessedAt: (options?.now ?? new Date()).toISOString(),
  };
}

export type EvidenceQualityDisplay = EvidenceQualityDescriptor;

type StoredEvidenceRecordLike = Partial<StoredEvidenceRecord> | null | undefined;

export type EvidenceReadout = {
  quality: EvidenceQuality;
  strongestLabel: string | null;
  reason: string;
  display: EvidenceQualityDisplay;
};

export type ClaimProofReadout = {
  quality: EvidenceQuality;
  canBackClaim: boolean;
  text: 'Strong proof · can back claim' | 'Weak proof · verify manually' | 'Insufficient proof';
  reason: string;
  display: EvidenceQualityDisplay;
};

function isEvidenceQuality(value: unknown): value is EvidenceQuality {
  return value === 'verified_candidate' || value === 'source_supported' || value === 'insufficient';
}

/**
 * Canonical evidence-quality copy/tone mapping for admin and web surfaces.
 * The single source of truth for evidence wording across the product.
 */
export function getEvidenceQualityDisplay(quality: EvidenceQuality): EvidenceQualityDisplay {
  return EVIDENCE_QUALITY_DESCRIPTORS[quality];
}

/**
 * Resolve the canonical evidence readout for any surface.
 *
 * Prefers persisted metadata when present, and safely falls back to a
 * live summary from source URLs for backward compatibility.
 */
export function resolveEvidenceReadout(options: {
  storedEvidence?: StoredEvidenceRecordLike;
  sourceUrls?: readonly string[];
}): EvidenceReadout {
  const fallback = summarizeEvidence(options.sourceUrls ?? []);
  const stored = options.storedEvidence;

  const quality = isEvidenceQuality(stored?.quality) ? stored.quality : fallback.quality;

  const strongestLabel =
    typeof stored?.strongestLabel === 'string' && stored.strongestLabel.trim().length > 0
      ? stored.strongestLabel
      : (fallback.strongest?.label ?? null);

  const reason =
    typeof stored?.reason === 'string' && stored.reason.trim().length > 0
      ? stored.reason
      : fallback.reviewReason;

  return {
    quality,
    strongestLabel,
    reason,
    display: getEvidenceQualityDisplay(quality),
  };
}

/**
 * Canonical claim-proof evaluation readout used by admin claims surfaces.
 */
export function getClaimProofReadout(evidenceUrls: readonly string[]): ClaimProofReadout | null {
  if (evidenceUrls.length === 0) return null;

  const summary = summarizeEvidence(evidenceUrls);
  const display = getEvidenceQualityDisplay(summary.quality);

  const text: ClaimProofReadout['text'] = summary.canSupportClaimVerification
    ? 'Strong proof · can back claim'
    : summary.hasPublicEvidence
      ? 'Weak proof · verify manually'
      : 'Insufficient proof';

  return {
    quality: summary.quality,
    canBackClaim: summary.canSupportClaimVerification,
    text,
    reason: summary.reviewReason,
    display,
  };
}

export type CommunityTrustMarker =
  | 'claimed'
  | 'strong_source'
  | 'provisional'
  | 'trending'
  | 'pulse';

type CommunityCardTrustInputs = {
  claimState: string;
  status: string;
  isTrending: boolean;
  hasStrongSource: boolean;
};

/**
 * Single priority policy for top-of-card trust markers.
 * Ownership (claimed) is the strongest public trust signal.
 */
export function getCommunityCardTrustMarkers({
  claimState,
  status,
  isTrending,
  hasStrongSource,
}: CommunityCardTrustInputs): CommunityTrustMarker[] {
  const markers: CommunityTrustMarker[] = [];

  if (claimState === 'CLAIMED') markers.push('claimed');
  if (hasStrongSource) markers.push('strong_source');
  if (status === 'UNVERIFIED' && claimState !== 'CLAIMED') markers.push('provisional');
  if (isTrending) markers.push('trending');

  if (markers.length === 0) markers.push('pulse');

  return markers;
}
