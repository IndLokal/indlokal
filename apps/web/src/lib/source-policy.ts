export type EvidenceTier =
  | 'owned_website'
  | 'official_registry'
  | 'institutional_directory'
  | 'supplementary'
  | 'blocked';

export type EvidenceAssessment = {
  tier: EvidenceTier;
  isQualifying: boolean;
  requiresReview: boolean;
  label: string;
  reason: string;
  normalizedUrl: string;
};

const BLOCKED_HOST_SUFFIXES = [
  'facebook.com',
  'fb.com',
  'm.me',
  'wa.me',
  'whatsapp.com',
  'chat.whatsapp.com',
  't.me',
  'telegram.me',
  'telegram.org',
] as const;

const SUPPLEMENTARY_HOST_SUFFIXES = [
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'maps.google.com',
  'google.com',
  'maps.app.goo.gl',
] as const;

const REGISTRY_HOST_SUFFIXES = [
  'handelsregister.de',
  'vereinsregister.de',
  'unternehmensregister.de',
  'justiz.de',
] as const;

const INSTITUTIONAL_HOST_SUFFIXES = [
  'forum-der-kulturen.de',
  'house-of-resources-stuttgart.de',
  'amka.de',
  'frankfurt.de',
  'vielfalt-bewegt-frankfurt.de',
  'stuttgart.de',
  'karlsruhe.de',
  'mannheim.de',
  'muenchen.de',
  'stadt.muenchen.de',
  'morgen-muenchen.de',
  'integrationsministerium-bw.de',
  'sozialministerium.baden-wuerttemberg.de',
  'aigev.org',
  'indoeuropean.eu',
  'cgimunich.gov.in',
  'indianembassyberlin.gov.in',
] as const;

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function matchesHost(hostname: string, suffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isGoogleMaps(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return (
    host === 'maps.app.goo.gl' ||
    host === 'maps.google.com' ||
    (host.endsWith('google.com') && url.pathname.toLowerCase().includes('/maps'))
  );
}

export function assessEvidenceUrl(input: string): EvidenceAssessment {
  const parsed = normalizeUrl(input);
  if (!parsed) {
    return {
      tier: 'blocked',
      isQualifying: false,
      requiresReview: true,
      label: 'Invalid URL',
      reason: 'Source evidence must be a parseable public URL.',
      normalizedUrl: input,
    };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      tier: 'blocked',
      isQualifying: false,
      requiresReview: true,
      label: 'Unsupported URL scheme',
      reason: 'Source evidence must be an http(s) URL.',
      normalizedUrl: parsed.toString(),
    };
  }

  if (matchesHost(parsed.hostname, BLOCKED_HOST_SUFFIXES)) {
    return {
      tier: 'blocked',
      isQualifying: false,
      requiresReview: true,
      label: 'Messaging or Facebook-only source',
      reason: 'Facebook, WhatsApp, and Telegram are channels, not sufficient production evidence.',
      normalizedUrl: parsed.toString(),
    };
  }

  if (isGoogleMaps(parsed) || matchesHost(parsed.hostname, SUPPLEMENTARY_HOST_SUFFIXES)) {
    return {
      tier: 'supplementary',
      isQualifying: false,
      requiresReview: true,
      label: 'Supplementary public profile',
      reason: 'Social profiles and map listings can support an entry but cannot be the only proof.',
      normalizedUrl: parsed.toString(),
    };
  }

  if (matchesHost(parsed.hostname, REGISTRY_HOST_SUFFIXES)) {
    return {
      tier: 'official_registry',
      isQualifying: true,
      requiresReview: true,
      label: 'German official register',
      reason: 'German register portals are valid proof for registered e.V. entities.',
      normalizedUrl: parsed.toString(),
    };
  }

  if (matchesHost(parsed.hostname, INSTITUTIONAL_HOST_SUFFIXES)) {
    return {
      tier: 'institutional_directory',
      isQualifying: true,
      requiresReview: true,
      label: 'Official or institutional directory',
      reason: 'Government, consular, umbrella, or institutional listing pages are valid evidence.',
      normalizedUrl: parsed.toString(),
    };
  }

  return {
    tier: 'owned_website',
    isQualifying: true,
    requiresReview: false,
    label: 'Owned website or public page',
    reason: 'A public non-social website is valid production evidence.',
    normalizedUrl: parsed.toString(),
  };
}

export function hasQualifyingEvidence(urls: readonly string[]): boolean {
  return urls.some((url) => assessEvidenceUrl(url).isQualifying);
}

export function getQualifyingEvidence(urls: readonly string[]): EvidenceAssessment[] {
  return urls.map((url) => assessEvidenceUrl(url)).filter((assessment) => assessment.isQualifying);
}
