import { describe, expect, it } from 'vitest';
import {
  assessEvidenceUrl,
  canCreateDraft,
  canMarkSourceSupported,
  canMarkVerifiedTrusted,
  canPublishUnverified,
  canSupportClaimVerification,
  detectGermanLegalEntityMarkers,
  getEvidenceReviewReason,
  getProfileSupportingEvidence,
  getQualifyingEvidence,
  getTrustSupportingEvidence,
  hasGermanLegalEntityMarker,
  hasQualifyingEvidence,
  hasUsablePublicEvidence,
  summarizeEvidence,
} from '../source-policy';

describe('assessEvidenceUrl — strong evidence', () => {
  it('classifies an owned/custom website as strong (auto, no review)', () => {
    const a = assessEvidenceUrl('https://hssgermany.org/');
    expect(a.tier).toBe('owned_website');
    expect(a.strength).toBe('strong');
    expect(a.isQualifying).toBe(true);
    expect(a.supportsVerifiedTrust).toBe(true);
    expect(a.supportsClaimVerification).toBe(true);
    expect(a.requiresReview).toBe(false);
  });

  it('classifies the official German register as the strongest tier', () => {
    const a = assessEvidenceUrl('https://www.handelsregister.de/rp_web/');
    expect(a.tier).toBe('official_registry');
    expect(a.confidence).toBe(100);
    expect(a.isQualifying).toBe(true);
    expect(a.requiresReview).toBe(true);
  });

  it('classifies a government / consular page as very strong', () => {
    expect(assessEvidenceUrl('https://www.cgimunich.gov.in/pages/Mjc2').tier).toBe(
      'government_consular',
    );
    expect(assessEvidenceUrl('https://www.stuttgart.de/service').tier).toBe('government_consular');
    expect(assessEvidenceUrl('https://example.gov.in/page').tier).toBe('government_consular');
  });

  it('classifies an institutional / umbrella directory as strong', () => {
    const a = assessEvidenceUrl('https://forum-der-kulturen.de/mitglieder');
    expect(a.tier).toBe('institutional_directory');
    expect(a.isQualifying).toBe(true);
  });
});

describe('assessEvidenceUrl — weak but useful evidence', () => {
  const weakCases: Array<[string, string]> = [
    ['https://www.facebook.com/hssdeutschland/', 'social_profile'],
    ['https://instagram.com/hssgermany/', 'social_profile'],
    ['https://www.linkedin.com/company/example', 'social_profile'],
    ['https://youtube.com/@example', 'social_profile'],
    ['https://maps.google.com/?cid=123', 'map_listing'],
    ['https://www.eventbrite.de/e/example-tickets-123', 'event_platform'],
    ['https://www.meetup.com/example-group/', 'event_platform'],
    ['https://linktr.ee/example', 'bio_link'],
  ];

  it.each(weakCases)('classifies %s as %s (weak, discovery only)', (url, tier) => {
    const a = assessEvidenceUrl(url);
    expect(a.tier).toBe(tier);
    expect(a.strength).toBe('weak');
    expect(a.supportsDiscovery).toBe(true);
    expect(a.supportsUnverifiedListing).toBe(true);
    expect(a.isQualifying).toBe(false);
    expect(a.supportsVerifiedTrust).toBe(false);
    expect(a.supportsClaimVerification).toBe(false);
    expect(a.requiresReview).toBe(true);
  });
});

describe('assessEvidenceUrl — Google domains classified separately', () => {
  it('treats Google Docs / Drive as a weak document link', () => {
    expect(assessEvidenceUrl('https://docs.google.com/document/d/abc').tier).toBe('document_link');
    expect(assessEvidenceUrl('https://drive.google.com/file/d/abc').tier).toBe('document_link');
    expect(assessEvidenceUrl('https://forms.gle/abc123').tier).toBe('document_link');
  });

  it('treats Google Sites as a medium hosted website builder', () => {
    const a = assessEvidenceUrl('https://sites.google.com/view/example');
    expect(a.tier).toBe('hosted_site_builder');
    expect(a.strength).toBe('medium');
    expect(a.isQualifying).toBe(false);
    expect(a.supportsDiscovery).toBe(true);
    expect(a.requiresReview).toBe(true);
  });

  it('treats Google Maps as a weak map listing', () => {
    expect(assessEvidenceUrl('https://www.google.com/maps/place/Example').tier).toBe('map_listing');
    expect(assessEvidenceUrl('https://maps.app.goo.gl/abc').tier).toBe('map_listing');
  });
});

describe('assessEvidenceUrl — hosted website builder', () => {
  it('classifies a Wix-hosted page as medium / reviewable', () => {
    const a = assessEvidenceUrl('https://example.wixsite.com/mysite');
    expect(a.tier).toBe('hosted_site_builder');
    expect(a.strength).toBe('medium');
    expect(a.supportsVerifiedTrust).toBe(false);
  });
});

describe('assessEvidenceUrl — messaging is not public evidence', () => {
  const messaging = [
    'https://chat.whatsapp.com/ABC123',
    'https://wa.me/491234567',
    'https://t.me/examplegroup',
    'https://discord.gg/abc123',
    'https://signal.group/#abc',
  ];

  it.each(messaging)('classifies %s as messaging (no public evidence)', (url) => {
    const a = assessEvidenceUrl(url);
    expect(a.tier).toBe('messaging');
    expect(a.strength).toBe('none');
    expect(a.supportsDiscovery).toBe(false);
    expect(a.supportsUnverifiedListing).toBe(false);
    expect(a.isQualifying).toBe(false);
  });
});

describe('assessEvidenceUrl — unsafe / invalid URLs are blocked', () => {
  it('blocks an invalid URL', () => {
    const a = assessEvidenceUrl('not a url at all');
    expect(a.tier).toBe('blocked');
    expect(a.label).toBe('Invalid URL');
  });

  it('blocks unsupported schemes', () => {
    expect(assessEvidenceUrl('ftp://example.com/file').tier).toBe('blocked');
    expect(assessEvidenceUrl('javascript:alert(1)').tier).toBe('blocked');
  });

  it('blocks localhost, internal domains, private IPs, and raw IPs', () => {
    expect(assessEvidenceUrl('http://localhost:3000/').tier).toBe('blocked');
    expect(assessEvidenceUrl('http://intranet/').tier).toBe('blocked');
    expect(assessEvidenceUrl('https://myserver.internal/page').tier).toBe('blocked');
    expect(assessEvidenceUrl('http://192.168.0.10/').tier).toBe('blocked');
    expect(assessEvidenceUrl('http://10.0.0.1/').tier).toBe('blocked');
    expect(assessEvidenceUrl('http://93.184.216.34/').tier).toBe('blocked');
  });
});

describe('assessEvidenceUrl — URL normalization', () => {
  it('accepts URLs without a protocol and normalizes to https', () => {
    const a = assessEvidenceUrl('hssgermany.org/about');
    expect(a.tier).toBe('owned_website');
    expect(a.normalizedUrl.startsWith('https://')).toBe(true);
  });

  it('normalizes the hostname (lowercase, strips www, trailing dot)', () => {
    const a = assessEvidenceUrl('https://WWW.Example.ORG./path');
    expect(a.hostname).toBe('example.org');
  });
});

describe('collection-level workflow decisions', () => {
  const weakOnly = ['https://instagram.com/example', 'https://chat.whatsapp.com/abc'];
  const strong = ['https://example.org/', 'https://instagram.com/example'];
  const messagingOnly = ['https://chat.whatsapp.com/abc'];

  it('allows discovery / unverified / source-supported on weak public evidence', () => {
    expect(hasUsablePublicEvidence(weakOnly)).toBe(true);
    expect(canCreateDraft(weakOnly)).toBe(true);
    expect(canPublishUnverified(weakOnly)).toBe(true);
    expect(canMarkSourceSupported(weakOnly)).toBe(true);
  });

  it('does not allow trust elevation or claim verification on weak evidence', () => {
    expect(canMarkVerifiedTrusted(weakOnly)).toBe(false);
    expect(canSupportClaimVerification(weakOnly)).toBe(false);
  });

  it('allows trust elevation and claim verification only with strong evidence', () => {
    expect(canMarkVerifiedTrusted(strong)).toBe(true);
    expect(canSupportClaimVerification(strong)).toBe(true);
  });

  it('rejects messaging-only evidence for every decision', () => {
    expect(hasUsablePublicEvidence(messagingOnly)).toBe(false);
    expect(canCreateDraft(messagingOnly)).toBe(false);
    expect(canPublishUnverified(messagingOnly)).toBe(false);
    expect(canMarkVerifiedTrusted(messagingOnly)).toBe(false);
  });

  it('keeps legacy isQualifying helpers meaning "strong evidence"', () => {
    expect(hasQualifyingEvidence(weakOnly)).toBe(false);
    expect(hasQualifyingEvidence(strong)).toBe(true);
    expect(getQualifyingEvidence(strong)).toHaveLength(1);
    expect(getTrustSupportingEvidence(strong)).toHaveLength(1);
    expect(getProfileSupportingEvidence(strong)).toHaveLength(1);
  });
});

describe('summarizeEvidence', () => {
  it('marks a verified candidate when strong evidence is present', () => {
    const s = summarizeEvidence(['https://example.org/', 'https://instagram.com/example']);
    expect(s.quality).toBe('verified_candidate');
    expect(s.score).toBe(70);
    expect(s.hasStrongEvidence).toBe(true);
    expect(s.canMarkVerifiedTrusted).toBe(true);
  });

  it('marks source-supported when only weak evidence is present', () => {
    const s = summarizeEvidence(['https://instagram.com/example']);
    expect(s.quality).toBe('source_supported');
    expect(s.canPublishUnverified).toBe(true);
    expect(s.canMarkVerifiedTrusted).toBe(false);
  });

  it('marks insufficient when there is no public evidence', () => {
    const s = summarizeEvidence(['https://chat.whatsapp.com/abc']);
    expect(s.quality).toBe('insufficient');
    expect(s.canCreateDraft).toBe(false);
    expect(getEvidenceReviewReason(['https://chat.whatsapp.com/abc'])).toContain(
      'No usable public evidence',
    );
  });
});

describe('hasGermanLegalEntityMarker — positives', () => {
  const positives = [
    'Samaikya Telugu Vedika e.V.',
    'Beispiel e. V.',
    'Beispiel eingetragener Verein',
    'Kultur Verein Stuttgart',
    'Example gGmbH',
    'Example GmbH',
    'Beispiel UG (haftungsbeschränkt)',
    'Logistik KG',
    'Wohnungsbau eG',
  ];

  it.each(positives)('detects a legal marker in "%s"', (text) => {
    expect(hasGermanLegalEntityMarker(text)).toBe(true);
  });

  it('reports which markers matched', () => {
    expect(detectGermanLegalEntityMarkers('Telugu Vedika e.V.')).toContain('e.V.');
    expect(detectGermanLegalEntityMarkers('Example gGmbH')).toContain('gGmbH');
  });
});

describe('hasGermanLegalEntityMarker — false positives avoided', () => {
  const falsePositives = [
    'Diwali Event Stuttgart',
    'Seva Foundation',
    'Software Development Group',
    'Developer Community',
    'Several Cultural Programs',
  ];

  it.each(falsePositives)('does not match "%s"', (text) => {
    expect(hasGermanLegalEntityMarker(text)).toBe(false);
  });
});
