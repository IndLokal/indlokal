/**
 * Source / evidence policy for community and organisation listings.
 *
 * Product blueprint: docs/SOURCE_AND_EVIDENCE_POLICY.md (read it for the
 * actors, the five decisions, and where this runs in the product).
 *
 * Guiding principle: **broad discovery + strict verification**.
 *
 * The goal is NOT to block weakly documented communities from being
 * discovered. The goal is to classify evidence correctly and keep five
 * decisions separate:
 *   1. can a draft/listing be created,
 *   2. can an unverified listing be published (source-supported),
 *   3. is a listing source-supported,
 *   4. is a listing verified/trusted,
 *   5. can evidence support organizer/admin claim verification.
 *
 * Weak public sources (social, maps, event pages, bio links) help DISCOVERY
 * and allow an unverified/source-supported listing, but never grant
 * verified/trusted status or claim verification on their own. Strong sources
 * (registry, government/consular, institutional directory, owned website) can
 * support trust elevation, usually with manual review. Messaging links and
 * private/internal/invalid URLs are not public evidence at all.
 *
 * Back-compat: the legacy outputs `tier`, `isQualifying`, `requiresReview`,
 * `label`, `reason`, `normalizedUrl` and the helpers `assessEvidenceUrl`,
 * `hasQualifyingEvidence`, `getQualifyingEvidence`, `hasGermanLegalEntityMarker`
 * are preserved. `isQualifying` keeps its original meaning: strong,
 * trust-supporting evidence (used by seeders / pipeline pin selection).
 */

/* ────────────────────────────────────────────────────────────────────────
 *  Types
 * ──────────────────────────────────────────────────────────────────────── */

export type EvidenceTier =
  // strong / trust-supporting
  | 'official_registry'
  | 'government_consular'
  | 'institutional_directory'
  | 'owned_website'
  // medium / reviewable
  | 'hosted_site_builder'
  // weak but useful (discovery / source-supported)
  | 'social_profile'
  | 'map_listing'
  | 'event_platform'
  | 'bio_link'
  | 'fundraising'
  | 'document_link'
  // legacy generic-weak value kept for stored-metadata compatibility
  | 'supplementary'
  // not public evidence
  | 'messaging'
  | 'blocked';

export type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'none';

export type EvidenceAssessment = {
  /** Granular source type / evidence tier. */
  tier: EvidenceTier;
  /** Coarse strength bucket derived from the tier. */
  strength: EvidenceStrength;
  /** Deterministic 0-100 confidence used only for admin sort/display. */
  confidence: number;

  // ── workflow capability flags ──
  /** May surface this entity for discovery. */
  supportsDiscovery: boolean;
  /** May publish as an unverified / source-supported listing. */
  supportsUnverifiedListing: boolean;
  /** May mark the listing "source-supported". */
  supportsSourceSupported: boolean;
  /** May elevate to verified/trusted status (with review). */
  supportsVerifiedTrust: boolean;
  /** May back an organizer/admin claim verification. */
  supportsClaimVerification: boolean;
  /** Admin should manually review before trust elevation. */
  requiresReview: boolean;

  /**
   * Legacy single boolean. Equivalent to "strong, trust-supporting evidence".
   * Prefer the granular `supports*` flags for new workflow decisions.
   */
  isQualifying: boolean;

  // ── display ──
  label: string;
  reason: string;
  normalizedUrl: string;
  hostname: string;
};

export type EvidenceQuality = 'verified_candidate' | 'source_supported' | 'insufficient';

export type EvidenceSummary = {
  quality: EvidenceQuality;
  /** Highest confidence across all assessed URLs. */
  score: number;
  /** The single strongest assessment, if any URLs were usable. */
  strongest: EvidenceAssessment | null;
  assessments: EvidenceAssessment[];

  hasPublicEvidence: boolean;
  hasStrongEvidence: boolean;

  canCreateDraft: boolean;
  canPublishUnverified: boolean;
  canMarkSourceSupported: boolean;
  canMarkVerifiedTrusted: boolean;
  canSupportClaimVerification: boolean;

  requiresReview: boolean;
  reviewReason: string;
};

/* ────────────────────────────────────────────────────────────────────────
 *  Trusted domain lists
 *
 *  Grouped and kept small/explicit so they can later move to config or a DB
 *  table without changing the classification logic. We deliberately avoid
 *  broad rules (e.g. blanket-classifying all of google.com) that could
 *  misclassify unrelated pages.
 * ──────────────────────────────────────────────────────────────────────── */

/** German company / association registers. */
const REGISTRY_HOST_SUFFIXES = [
  'handelsregister.de',
  'vereinsregister.de',
  'unternehmensregister.de',
  'justiz.de',
] as const;

/** Government and consular pages (city, state, federal, Indian missions). */
const GOVERNMENT_CONSULAR_HOST_SUFFIXES = [
  // German city / state administration
  'stuttgart.de',
  'karlsruhe.de',
  'mannheim.de',
  'muenchen.de',
  'stadt.muenchen.de',
  'frankfurt.de',
  'amka.de',
  'integrationsministerium-bw.de',
  'sozialministerium.baden-wuerttemberg.de',
  // Indian government / consular
  'cgimunich.gov.in',
  'cgifrankfurt.gov.in',
  'indianembassyberlin.gov.in',
  'mea.gov.in',
] as const;

/** Precise government suffixes that are safe as a broad trust signal. */
const GOVERNMENT_TLD_SUFFIXES = ['gov', 'gov.in', 'bund.de'] as const;

/** Trusted institutional / umbrella directory pages. */
const INSTITUTIONAL_HOST_SUFFIXES = [
  'forum-der-kulturen.de',
  'house-of-resources-stuttgart.de',
  'vielfalt-bewegt-frankfurt.de',
  'morgen-muenchen.de',
  'aigev.org',
  'indoeuropean.eu',
] as const;

/** Messaging channels — contact info, not public evidence. */
const MESSAGING_HOST_SUFFIXES = [
  'wa.me',
  'whatsapp.com',
  'chat.whatsapp.com',
  't.me',
  'telegram.me',
  'telegram.org',
  'discord.gg',
  'discord.com',
  'discordapp.com',
  'signal.group',
  'signal.me',
  'm.me', // Facebook Messenger
  'join.skype.com',
] as const;

/** Social network profile pages. */
const SOCIAL_HOST_SUFFIXES = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'x.com',
  'twitter.com',
  't.co',
  'threads.net',
  'tiktok.com',
  'pinterest.com',
] as const;

/** Map / business-listing pages. */
const MAP_HOST_SUFFIXES = ['g.page', 'yelp.com', 'openstreetmap.org'] as const;

/** Event platforms. */
const EVENT_PLATFORM_HOST_SUFFIXES = [
  'meetup.com',
  'eventbrite.com',
  'eventbrite.de',
  'eventbrite.co.uk',
  'allevents.in',
  'ra.co',
  'dice.fm',
  'billetto.de',
  'billetto.com',
] as const;

/** Bio-link / link-in-bio aggregators. */
const BIO_LINK_HOST_SUFFIXES = [
  'linktr.ee',
  'linktree.com',
  'beacons.ai',
  'bio.link',
  'lnk.bio',
  'carrd.co',
  'taplink.cc',
  'msha.ke',
  'about.me',
] as const;

/** Fundraising / membership pages. */
const FUNDRAISING_HOST_SUFFIXES = [
  'gofundme.com',
  'gofund.me',
  'betterplace.org',
  'patreon.com',
  'ko-fi.com',
  'kickstarter.com',
  'indiegogo.com',
] as const;

/** Hosted website-builder pages (medium confidence, reviewable). */
const HOSTED_SITE_BUILDER_HOST_SUFFIXES = [
  'sites.google.com',
  'wixsite.com',
  'weebly.com',
  'godaddysites.com',
  'jimdosite.com',
  'jimdofree.com',
  'blogspot.com',
  'wordpress.com',
  'webnode.page',
  'webador.com',
] as const;

/** Internal / non-public DNS suffixes that must never count as evidence. */
const INTERNAL_HOST_SUFFIXES = [
  'local',
  'localhost',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'test',
  'example',
  'invalid',
] as const;

/* ────────────────────────────────────────────────────────────────────────
 *  German legal-entity markers
 *
 *  Used as a supporting text/impressum trust signal — it does NOT replace a
 *  qualifying public evidence URL. Matching is boundary-aware so common words
 *  ("event", "seva", "development") never trigger a false positive, and the
 *  e.V. form requires at least one period so a bare "ev" substring is ignored.
 * ──────────────────────────────────────────────────────────────────────── */

/** Canonical marker labels (also exported for back-compat). */
export const GERMAN_LEGAL_ENTITY_MARKERS = [
  'e.V.',
  'eingetragener Verein',
  'Verein',
  'gUG',
  'UG',
  'gGmbH',
  'GmbH',
  'KG',
  'eG',
] as const;

const GERMAN_LEGAL_MARKER_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Requires the leading period of "e.V." / "e. V." so plain "ev" never matches.
  { label: 'e.V.', pattern: /(?<![a-z0-9])e\.\s?v\.?(?![a-z0-9])/ },
  { label: 'eingetragener Verein', pattern: /(?<![a-z0-9])eingetragener\s+verein(?![a-z0-9])/ },
  { label: 'Verein', pattern: /(?<![a-z0-9])verein(?![a-z0-9])/ },
  { label: 'gUG', pattern: /(?<![a-z0-9])gug(?:\s*\(haftungsbeschraenkt\))?(?![a-z0-9])/ },
  { label: 'UG', pattern: /(?<![a-z0-9])ug(?:\s*\(haftungsbeschraenkt\))?(?![a-z0-9])/ },
  { label: 'gGmbH', pattern: /(?<![a-z0-9])ggmbh(?![a-z0-9])/ },
  { label: 'GmbH', pattern: /(?<![a-z0-9])gmbh(?![a-z0-9])/ },
  { label: 'KG', pattern: /(?<![a-z0-9])kg(?![a-z0-9])/ },
  { label: 'eG', pattern: /(?<![a-z0-9])eg(?![a-z0-9])/ },
];

function normalizeGermanText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Returns the matched German legal-entity marker labels (deduped). */
export function detectGermanLegalEntityMarkers(input: string): string[] {
  const text = normalizeGermanText(input);
  const matched = new Set<string>();
  for (const { label, pattern } of GERMAN_LEGAL_MARKER_PATTERNS) {
    if (pattern.test(text)) matched.add(label);
  }
  return [...matched];
}

export function hasGermanLegalEntityMarker(input: string): boolean {
  const text = normalizeGermanText(input);
  return GERMAN_LEGAL_MARKER_PATTERNS.some(({ pattern }) => pattern.test(text));
}

/* ────────────────────────────────────────────────────────────────────────
 *  URL safety + normalization
 * ──────────────────────────────────────────────────────────────────────── */

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept URLs with or without protocol; default missing protocol to https.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function canonicalHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/\.$/, '') // trailing dot
    .replace(/^www\./, '');
}

function matchesHost(hostname: string, suffixes: readonly string[]): boolean {
  const host = canonicalHost(hostname);
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isRawIpAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '');
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((part) => Number(part) <= 255);
  }
  // IPv6 (URL hostnames keep the colons)
  return host.includes(':');
}

function isPrivateOrInternalHost(hostname: string): boolean {
  const host = canonicalHost(hostname);
  if (host === 'localhost') return true;
  // Internal / reserved DNS suffixes and single-label (no-dot) hosts.
  if (!host.includes('.')) return true;
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return true;
  }
  // Private / loopback / link-local IPv4 ranges.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return (
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('127.') ||
      host.startsWith('169.254.') ||
      host.startsWith('0.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  }
  return false;
}

function isGoogleHost(host: string): boolean {
  return (
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    host === 'goo.gl' ||
    host.endsWith('.goo.gl')
  );
}

/* ────────────────────────────────────────────────────────────────────────
 *  Tier → capability/strength mapping
 * ──────────────────────────────────────────────────────────────────────── */

const STRONG_TIERS = new Set<EvidenceTier>([
  'official_registry',
  'government_consular',
  'institutional_directory',
  'owned_website',
]);

const TIER_CONFIDENCE: Record<EvidenceTier, number> = {
  official_registry: 100,
  government_consular: 90,
  institutional_directory: 80,
  owned_website: 70,
  hosted_site_builder: 50,
  social_profile: 30,
  map_listing: 30,
  event_platform: 30,
  bio_link: 30,
  fundraising: 30,
  document_link: 30,
  supplementary: 30,
  messaging: 0,
  blocked: 0,
};

function strengthForTier(tier: EvidenceTier): EvidenceStrength {
  if (STRONG_TIERS.has(tier)) return 'strong';
  if (tier === 'hosted_site_builder') return 'medium';
  if (tier === 'messaging' || tier === 'blocked') return 'none';
  return 'weak';
}

function buildAssessment(
  tier: EvidenceTier,
  url: URL,
  label: string,
  reason: string,
  // owned_website is the only strong tier that is safe to auto-seed without review.
  requiresReview = true,
): EvidenceAssessment {
  const strength = strengthForTier(tier);
  const isStrong = strength === 'strong';
  const isPublic = strength !== 'none';
  return {
    tier,
    strength,
    confidence: TIER_CONFIDENCE[tier],
    supportsDiscovery: isPublic,
    supportsUnverifiedListing: isPublic,
    supportsSourceSupported: isPublic,
    supportsVerifiedTrust: isStrong,
    supportsClaimVerification: isStrong,
    requiresReview,
    isQualifying: isStrong,
    label,
    reason,
    normalizedUrl: url.toString(),
    hostname: canonicalHost(url.hostname),
  };
}

function blockedAssessment(
  rawInput: string,
  url: URL | null,
  label: string,
  reason: string,
): EvidenceAssessment {
  return {
    tier: 'blocked',
    strength: 'none',
    confidence: 0,
    supportsDiscovery: false,
    supportsUnverifiedListing: false,
    supportsSourceSupported: false,
    supportsVerifiedTrust: false,
    supportsClaimVerification: false,
    requiresReview: true,
    isQualifying: false,
    label,
    reason,
    normalizedUrl: url ? url.toString() : rawInput,
    hostname: url ? canonicalHost(url.hostname) : '',
  };
}

/* ────────────────────────────────────────────────────────────────────────
 *  Single-URL assessment
 * ──────────────────────────────────────────────────────────────────────── */

export function assessEvidenceUrl(input: string): EvidenceAssessment {
  const parsed = normalizeUrl(input);
  if (!parsed) {
    return blockedAssessment(
      input,
      null,
      'Invalid URL',
      'Source evidence must be a parseable public URL.',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return blockedAssessment(
      input,
      parsed,
      'Unsupported URL scheme',
      'Source evidence must be an http(s) URL.',
    );
  }

  const host = canonicalHost(parsed.hostname);

  if (isRawIpAddress(parsed.hostname) || isPrivateOrInternalHost(parsed.hostname)) {
    return blockedAssessment(
      input,
      parsed,
      'Private or internal address',
      'Raw IPs, localhost, and internal/private hosts are not public organisation evidence.',
    );
  }

  // Messaging channels are contact info, never public evidence.
  if (matchesHost(host, MESSAGING_HOST_SUFFIXES)) {
    return {
      ...blockedAssessment(
        input,
        parsed,
        'Messaging channel',
        'WhatsApp, Telegram, Discord, and Signal links are contact channels, not public evidence.',
      ),
      tier: 'messaging',
    };
  }

  // ── Strong evidence ──
  if (matchesHost(host, REGISTRY_HOST_SUFFIXES)) {
    return buildAssessment(
      'official_registry',
      parsed,
      'German official register',
      'German register portals are the strongest proof for registered entities.',
    );
  }

  if (
    matchesHost(host, GOVERNMENT_CONSULAR_HOST_SUFFIXES) ||
    matchesHost(host, GOVERNMENT_TLD_SUFFIXES)
  ) {
    return buildAssessment(
      'government_consular',
      parsed,
      'Government or consular page',
      'Official government, city, or consular pages are very strong evidence.',
    );
  }

  if (matchesHost(host, INSTITUTIONAL_HOST_SUFFIXES)) {
    return buildAssessment(
      'institutional_directory',
      parsed,
      'Institutional or umbrella directory',
      'Trusted institutional / umbrella directory pages are strong evidence.',
    );
  }

  // ── Google products: classify each separately, never a broad google.com rule ──
  if (isGoogleHost(host)) {
    const path = parsed.pathname.toLowerCase();
    if (host === 'maps.google.com' || host === 'maps.app.goo.gl' || path.startsWith('/maps')) {
      return buildAssessment(
        'map_listing',
        parsed,
        'Google Maps listing',
        'Map listings can support discovery but cannot be the only proof.',
      );
    }
    if (host === 'sites.google.com') {
      return buildAssessment(
        'hosted_site_builder',
        parsed,
        'Google Sites page',
        'Hosted website-builder pages are medium confidence and need review.',
      );
    }
    if (host === 'docs.google.com' || host === 'drive.google.com') {
      return buildAssessment(
        'document_link',
        parsed,
        'Google Docs / Drive',
        'Shared documents are weak supporting material, not verified evidence.',
      );
    }
    // Any other google.com / goo.gl page: weak, manual review.
    return buildAssessment(
      'document_link',
      parsed,
      'Google page (manual review)',
      'Generic Google pages are weak supporting material and need review.',
    );
  }

  if (host === 'forms.gle') {
    return buildAssessment(
      'document_link',
      parsed,
      'Google Forms',
      'Shared documents are weak supporting material, not verified evidence.',
    );
  }

  // ── Weak but useful evidence ──
  if (matchesHost(host, SOCIAL_HOST_SUFFIXES)) {
    return buildAssessment(
      'social_profile',
      parsed,
      'Social profile',
      'Social profiles support discovery and source-supported listings, not trusted status.',
    );
  }

  if (matchesHost(host, MAP_HOST_SUFFIXES)) {
    return buildAssessment(
      'map_listing',
      parsed,
      'Map or business listing',
      'Map listings can support discovery but cannot be the only proof.',
    );
  }

  if (matchesHost(host, EVENT_PLATFORM_HOST_SUFFIXES)) {
    return buildAssessment(
      'event_platform',
      parsed,
      'Event platform page',
      'Event-platform pages support discovery, not trusted status.',
    );
  }

  if (matchesHost(host, BIO_LINK_HOST_SUFFIXES)) {
    return buildAssessment(
      'bio_link',
      parsed,
      'Link-in-bio page',
      'Bio-link pages support discovery, not trusted status.',
    );
  }

  if (matchesHost(host, FUNDRAISING_HOST_SUFFIXES)) {
    return buildAssessment(
      'fundraising',
      parsed,
      'Fundraising or membership page',
      'Fundraising pages support discovery, not trusted status.',
    );
  }

  if (matchesHost(host, HOSTED_SITE_BUILDER_HOST_SUFFIXES)) {
    return buildAssessment(
      'hosted_site_builder',
      parsed,
      'Hosted website-builder page',
      'Website-builder pages are medium confidence and need review before trust.',
    );
  }

  // ── Fallthrough: an owned / custom public website ──
  return buildAssessment(
    'owned_website',
    parsed,
    'Owned website or public page',
    'A public non-social website is strong production evidence.',
    /* requiresReview */ false,
  );
}

/* ────────────────────────────────────────────────────────────────────────
 *  Multi-URL helpers
 * ──────────────────────────────────────────────────────────────────────── */

export function assessEvidenceUrls(urls: readonly string[]): EvidenceAssessment[] {
  return urls.map((url) => assessEvidenceUrl(url));
}

/** Any usable public evidence (weak or stronger). */
export function hasUsablePublicEvidence(urls: readonly string[]): boolean {
  return urls.some((url) => assessEvidenceUrl(url).supportsDiscovery);
}

/** Strong, trust-supporting evidence only. */
export function getTrustSupportingEvidence(urls: readonly string[]): EvidenceAssessment[] {
  return assessEvidenceUrls(urls).filter((a) => a.supportsVerifiedTrust);
}

/** Weak/medium profile-supporting evidence (discovery, not trust). */
export function getProfileSupportingEvidence(urls: readonly string[]): EvidenceAssessment[] {
  return assessEvidenceUrls(urls).filter((a) => a.supportsDiscovery && !a.supportsVerifiedTrust);
}

// ── Legacy helpers (isQualifying === strong / trust-supporting) ──
export function hasQualifyingEvidence(urls: readonly string[]): boolean {
  return urls.some((url) => assessEvidenceUrl(url).isQualifying);
}

export function getQualifyingEvidence(urls: readonly string[]): EvidenceAssessment[] {
  return assessEvidenceUrls(urls).filter((a) => a.isQualifying);
}

// ── Workflow decision helpers ──

/** A draft/listing may be created if any usable public source exists. */
export function canCreateDraft(urls: readonly string[]): boolean {
  return hasUsablePublicEvidence(urls);
}

/** An unverified / source-supported listing may be published. */
export function canPublishUnverified(urls: readonly string[]): boolean {
  return hasUsablePublicEvidence(urls);
}

/** A listing may be marked "source-supported". */
export function canMarkSourceSupported(urls: readonly string[]): boolean {
  return hasUsablePublicEvidence(urls);
}

/** A listing may be elevated to verified/trusted (strong evidence required). */
export function canMarkVerifiedTrusted(urls: readonly string[]): boolean {
  return urls.some((url) => assessEvidenceUrl(url).supportsVerifiedTrust);
}

/** Evidence may back an organizer/admin claim verification. */
export function canSupportClaimVerification(urls: readonly string[]): boolean {
  return urls.some((url) => assessEvidenceUrl(url).supportsClaimVerification);
}

/* ────────────────────────────────────────────────────────────────────────
 *  Evidence summary (deterministic trust readout for admin UI)
 * ──────────────────────────────────────────────────────────────────────── */

export function summarizeEvidence(urls: readonly string[]): EvidenceSummary {
  const assessments = assessEvidenceUrls(urls);
  const publicAssessments = assessments.filter((a) => a.supportsDiscovery);

  const hasStrongEvidence = assessments.some((a) => a.supportsVerifiedTrust);
  const hasPublicEvidence = publicAssessments.length > 0;

  const strongest =
    assessments.reduce<EvidenceAssessment | null>((best, current) => {
      if (current.strength === 'none') return best;
      if (!best || current.confidence > best.confidence) return current;
      return best;
    }, null) ?? null;

  const score = strongest ? strongest.confidence : 0;

  const quality: EvidenceQuality = hasStrongEvidence
    ? 'verified_candidate'
    : hasPublicEvidence
      ? 'source_supported'
      : 'insufficient';

  const requiresReview = !hasPublicEvidence || publicAssessments.some((a) => a.requiresReview);

  return {
    quality,
    score,
    strongest,
    assessments,
    hasPublicEvidence,
    hasStrongEvidence,
    canCreateDraft: hasPublicEvidence,
    canPublishUnverified: hasPublicEvidence,
    canMarkSourceSupported: hasPublicEvidence,
    canMarkVerifiedTrusted: hasStrongEvidence,
    canSupportClaimVerification: hasStrongEvidence,
    requiresReview,
    reviewReason: buildReviewReason(quality, strongest),
  };
}

function buildReviewReason(quality: EvidenceQuality, strongest: EvidenceAssessment | null): string {
  switch (quality) {
    case 'verified_candidate':
      return `Strong evidence (${strongest?.label ?? 'trusted source'}). Eligible for verified/trusted status after manual review.`;
    case 'source_supported':
      return `Only weak public sources (${strongest?.label ?? 'profile page'}). Can be listed as source-supported/unverified; strong evidence or manual review is required before trusted status or claim verification.`;
    case 'insufficient':
    default:
      return 'No usable public evidence. Provide a public website, official register, government/consular, or institutional listing.';
  }
}

/** Convenience: a human-readable review reason for a set of URLs. */
export function getEvidenceReviewReason(urls: readonly string[]): string {
  return summarizeEvidence(urls).reviewReason;
}
