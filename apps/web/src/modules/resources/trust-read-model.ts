import type { ContentSource, ResourceType } from '@prisma/client';

export type ResourceTrustBand = 'STRONG_SOURCE' | 'SOURCE_SUPPORTED' | 'NEEDS_VERIFICATION';

export interface ResourceTrustProjection {
  trustBand: ResourceTrustBand;
  trustBandLabel: 'Strong Source' | 'Source-Supported' | 'Needs Verification';
  sourceLabel: 'Official Source' | 'Community Curated' | 'Imported' | 'User Suggested';
  verificationMethod: string;
  lastVerifiedAt: Date | null;
  lastVerifiedAtDisplay: string;
}

const OFFICIAL_TYPES = new Set<ResourceType>([
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
]);

const TRUST_BAND_LABELS: Record<ResourceTrustBand, ResourceTrustProjection['trustBandLabel']> = {
  STRONG_SOURCE: 'Strong Source',
  SOURCE_SUPPORTED: 'Source-Supported',
  NEEDS_VERIFICATION: 'Needs Verification',
};

const SOURCE_LABELS: Record<ContentSource, ResourceTrustProjection['sourceLabel']> = {
  ADMIN_SEED: 'Official Source',
  COMMUNITY_SUBMITTED: 'Community Curated',
  IMPORTED: 'Imported',
  USER_SUGGESTED: 'User Suggested',
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asTrustBand(v: unknown): ResourceTrustBand | null {
  if (v === 'STRONG_SOURCE' || v === 'SOURCE_SUPPORTED' || v === 'NEEDS_VERIFICATION') return v;
  return null;
}

function formatLastVerifiedAt(lastReviewedAt: Date | null): string {
  if (!lastReviewedAt) return 'Not yet verified';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(lastReviewedAt);
}

export function projectResourceTrust(input: {
  resourceType: ResourceType;
  source: ContentSource;
  metadata: unknown;
  lastReviewedAt: Date | null;
}): ResourceTrustProjection {
  const metadata = asRecord(input.metadata);
  const metadataTrust = asRecord(metadata?.trust);
  const explicitBand = asTrustBand(metadataTrust?.band);
  const metadataMethod =
    typeof metadataTrust?.verificationMethod === 'string' ? metadataTrust.verificationMethod : null;

  let trustBand: ResourceTrustBand;
  if (explicitBand) {
    trustBand = explicitBand;
  } else if (OFFICIAL_TYPES.has(input.resourceType)) {
    trustBand = 'STRONG_SOURCE';
  } else if (input.source === 'ADMIN_SEED' || input.source === 'IMPORTED') {
    trustBand = 'SOURCE_SUPPORTED';
  } else {
    trustBand = 'NEEDS_VERIFICATION';
  }

  const sourceLabel = SOURCE_LABELS[input.source];
  const verificationMethod =
    metadataMethod ??
    (trustBand === 'STRONG_SOURCE'
      ? 'Official source verification'
      : trustBand === 'SOURCE_SUPPORTED'
        ? 'Editorial source review'
        : 'Verification pending');

  return {
    trustBand,
    trustBandLabel: TRUST_BAND_LABELS[trustBand],
    sourceLabel,
    verificationMethod,
    lastVerifiedAt: input.lastReviewedAt,
    lastVerifiedAtDisplay: formatLastVerifiedAt(input.lastReviewedAt),
  };
}
