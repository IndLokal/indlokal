import { describe, it, expect } from 'vitest';
import {
  getCommunityEvidenceBadge,
  badgeFromSummary,
  buildStoredEvidence,
  getClaimProofReadout,
  getCommunityCardTrustMarkers,
  getEvidenceQualityDisplay,
  resolveEvidenceReadout,
} from '../community-trust';
import { summarizeEvidence } from '../source-policy';

describe('getCommunityEvidenceBadge', () => {
  it('returns a strong_source badge for strong evidence', () => {
    const badge = getCommunityEvidenceBadge(['https://www.handelsregister.de/rp_web/welcome.do']);
    expect(badge).not.toBeNull();
    expect(badge?.kind).toBe('strong_source');
    expect(badge?.label).toBe('Strong source');
    expect(badge?.quality).toBe('verified_candidate');
  });

  it('returns a source_supported badge for weak public evidence only', () => {
    const badge = getCommunityEvidenceBadge(['https://www.instagram.com/some_community']);
    expect(badge).not.toBeNull();
    expect(badge?.kind).toBe('source_supported');
    expect(badge?.label).toBe('Source-supported');
    expect(badge?.quality).toBe('source_supported');
  });

  it('returns null when there is no usable public evidence', () => {
    expect(getCommunityEvidenceBadge([])).toBeNull();
    expect(getCommunityEvidenceBadge(['http://localhost:3000'])).toBeNull();
  });

  it('prefers the strongest tier when both strong and weak links are present', () => {
    const badge = getCommunityEvidenceBadge([
      'https://www.instagram.com/some_community',
      'https://www.handelsregister.de/rp_web/welcome.do',
    ]);
    expect(badge?.kind).toBe('strong_source');
  });

  it('badgeFromSummary mirrors getCommunityEvidenceBadge', () => {
    const urls = ['https://www.instagram.com/some_community'];
    expect(badgeFromSummary(summarizeEvidence(urls))).toEqual(getCommunityEvidenceBadge(urls));
  });
});

describe('buildStoredEvidence', () => {
  const fixedNow = new Date('2026-06-08T00:00:00.000Z');

  it('produces the canonical record shape for strong evidence', () => {
    const record = buildStoredEvidence(['https://www.handelsregister.de/rp_web/welcome.do'], {
      now: fixedNow,
    });
    expect(record).toEqual({
      quality: 'verified_candidate',
      score: expect.any(Number),
      strongestTier: expect.any(String),
      strongestLabel: expect.any(String),
      requiresReview: expect.any(Boolean),
      reason: expect.any(String),
      assessedAt: '2026-06-08T00:00:00.000Z',
    });
  });

  it('grades weak public sources as source_supported', () => {
    const record = buildStoredEvidence(['https://www.instagram.com/some_community'], {
      now: fixedNow,
    });
    expect(record.quality).toBe('source_supported');
  });

  it('grades no usable sources as insufficient with a null strongest tier', () => {
    const record = buildStoredEvidence([], { now: fixedNow });
    expect(record.quality).toBe('insufficient');
    expect(record.strongestTier).toBeNull();
    expect(record.strongestLabel).toBeNull();
  });

  it('always exposes a quality field (the key the admin chip relies on)', () => {
    for (const urls of [[], ['https://x.test'], ['https://www.handelsregister.de/']]) {
      expect(buildStoredEvidence(urls, { now: fixedNow })).toHaveProperty('quality');
    }
  });
});

describe('getEvidenceQualityDisplay', () => {
  it('maps quality values to stable labels and tones', () => {
    expect(getEvidenceQualityDisplay('verified_candidate')).toMatchObject({
      shortLabel: 'Strong',
      label: 'Strong source',
      tone: 'strong',
    });
    expect(getEvidenceQualityDisplay('source_supported')).toMatchObject({
      shortLabel: 'Source',
      label: 'Source-supported',
      tone: 'supported',
    });
    expect(getEvidenceQualityDisplay('insufficient')).toMatchObject({
      shortLabel: 'Insufficient',
      label: 'Insufficient evidence',
      tone: 'insufficient',
    });
  });

  it('never labels a source as "Verified" (reserved for the org/claim axis)', () => {
    for (const quality of ['verified_candidate', 'source_supported', 'insufficient'] as const) {
      const display = getEvidenceQualityDisplay(quality);
      expect(display.label.toLowerCase()).not.toContain('verified');
      expect(display.shortLabel.toLowerCase()).not.toContain('verified');
    }
  });
});

describe('resolveEvidenceReadout', () => {
  it('uses persisted metadata when present', () => {
    const readout = resolveEvidenceReadout({
      storedEvidence: {
        quality: 'source_supported',
        strongestLabel: 'Social profile',
        reason: 'Stored reason',
      },
      sourceUrls: ['https://www.handelsregister.de/rp_web/welcome.do'],
    });

    expect(readout.quality).toBe('source_supported');
    expect(readout.strongestLabel).toBe('Social profile');
    expect(readout.reason).toBe('Stored reason');
    expect(readout.display.label).toBe('Source-supported');
  });

  it('falls back to live summary when persisted metadata is incomplete', () => {
    const readout = resolveEvidenceReadout({
      storedEvidence: {},
      sourceUrls: ['https://www.handelsregister.de/rp_web/welcome.do'],
    });

    expect(readout.quality).toBe('verified_candidate');
    expect(readout.strongestLabel).toBeTruthy();
    expect(readout.reason.length).toBeGreaterThan(0);
  });
});

describe('getClaimProofReadout', () => {
  it('returns can-back-claim readout for strong proof', () => {
    const proof = getClaimProofReadout(['https://www.handelsregister.de/rp_web/welcome.do']);
    expect(proof).not.toBeNull();
    expect(proof?.canBackClaim).toBe(true);
    expect(proof?.text).toBe('Strong proof · can back claim');
    expect(proof?.display.tone).toBe('strong');
  });

  it('returns weak-proof readout for weak public sources', () => {
    const proof = getClaimProofReadout(['https://www.instagram.com/some_community']);
    expect(proof?.canBackClaim).toBe(false);
    expect(proof?.text).toBe('Weak proof · verify manually');
    expect(proof?.display.tone).toBe('supported');
  });

  it('returns insufficient-proof readout for non-public evidence', () => {
    const proof = getClaimProofReadout(['https://chat.whatsapp.com/abc']);
    expect(proof?.canBackClaim).toBe(false);
    expect(proof?.text).toBe('Insufficient proof');
    expect(proof?.display.tone).toBe('insufficient');
  });

  it('returns null when there are no evidence links', () => {
    expect(getClaimProofReadout([])).toBeNull();
  });
});

describe('getCommunityCardTrustMarkers', () => {
  it('prioritizes claimed before all other markers', () => {
    const markers = getCommunityCardTrustMarkers({
      claimState: 'CLAIMED',
      status: 'UNVERIFIED',
      isTrending: true,
      hasStrongSource: true,
    });
    expect(markers[0]).toBe('claimed');
    expect(markers).toContain('strong_source');
  });

  it('omits provisional when claimed', () => {
    const markers = getCommunityCardTrustMarkers({
      claimState: 'CLAIMED',
      status: 'UNVERIFIED',
      isTrending: false,
      hasStrongSource: false,
    });
    expect(markers).not.toContain('provisional');
  });

  it('falls back to pulse when no trust/status signals are present', () => {
    const markers = getCommunityCardTrustMarkers({
      claimState: 'UNCLAIMED',
      status: 'ACTIVE',
      isTrending: false,
      hasStrongSource: false,
    });
    expect(markers).toEqual(['pulse']);
  });
});
