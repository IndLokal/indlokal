import { describe, expect, it } from 'vitest';
import { assessResourceApprovalEligibility, shouldAutoApprovePipelineItem } from '../review';

describe('shouldAutoApprovePipelineItem', () => {
  const trustedReliability = {
    key: 'WEBSITE_SCRAPE:COMMUNITY' as const,
    sourceType: 'WEBSITE_SCRAPE' as const,
    lane: 'COMMUNITY' as const,
    pending: 0,
    approved: 9,
    rejected: 1,
    merged: 0,
    totalReviewed: 10,
    approvalRate: 0.9,
    confidenceAdjustment: 0,
  };

  it('rejects auto-approval when resolution provenance has a city conflict', () => {
    const result = shouldAutoApprovePipelineItem({
      item: {
        type: 'COMMUNITY',
        name: 'Indian Association Stuttgart',
        description: 'Community group',
        cityName: 'Stuttgart',
        categories: ['culture'],
        languages: ['en'],
        websiteUrl: 'https://example.org',
        facebookUrl: null,
        instagramUrl: null,
        whatsappUrl: null,
        telegramUrl: null,
        contactEmail: null,
        confidence: 0.95,
        fieldConfidence: {},
      },
      sourceType: 'WEBSITE_SCRAPE',
      reliability: trustedReliability,
      matchedEntityId: null,
      matchScore: null,
      resolutionProvenance: {
        citySource: 'signal',
        cityConflict: true,
        communitySource: 'hint',
        resolutionConfidence: 0.95,
      },
    });

    expect(result).toEqual({ eligible: false, reason: 'city-conflict-admin-review-required' });
  });

  it('rejects auto-approval when resolution confidence is below threshold', () => {
    const result = shouldAutoApprovePipelineItem({
      item: {
        type: 'EVENT',
        title: 'Diwali Meetup',
        description: null,
        date: '2026-10-20',
        time: '18:00',
        endDate: null,
        endTime: null,
        venueName: 'Hall',
        venueAddress: null,
        cityName: 'Stuttgart',
        isOnline: false,
        isFree: true,
        cost: null,
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'OPEN_ENTRY',
        requiresRegistration: false,
        requiresApproval: false,
        entryNote: null,
        registrationUrl: null,
        imageUrl: null,
        hostCommunity: 'Indian Association Stuttgart',
        categories: [],
        languages: [],
        confidence: 0.95,
        fieldConfidence: {},
      },
      sourceType: 'WEBSITE_SCRAPE',
      reliability: trustedReliability,
      matchedEntityId: null,
      matchScore: null,
      resolutionProvenance: {
        citySource: 'fallback',
        cityConflict: false,
        communitySource: 'unattached',
        resolutionConfidence: 0.45,
      },
    });

    expect(result).toEqual({ eligible: false, reason: 'resolution-confidence-below-threshold' });
  });
});

describe('assessResourceApprovalEligibility', () => {
  it('rejects weak non-official resource urls', () => {
    const result = assessResourceApprovalEligibility({
      resource: {
        type: 'RESOURCE',
        title: 'Visa tips roundup',
        description: 'Helpful tips',
        cityName: 'Stuttgart',
        resourceType: 'VISA_SERVICE',
        scope: 'CITY',
        scopeRegion: 'stuttgart',
        audiences: ['NEWCOMER'],
        lifecycleStage: ['PRE_ARRIVAL'],
        url: 'https://eventbrite.com/e/some-resource',
        validUntil: null,
        isOfficialSource: false,
        confidence: 0.92,
        fieldConfidence: {},
      },
      sourceUrl: 'https://eventbrite.com/e/some-resource',
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'resource-approval-requires-official-or-institutional-domain',
    });
  });

  it('accepts institutional urls and falls back to sourceUrl when resource url is missing', () => {
    const result = assessResourceApprovalEligibility({
      resource: {
        type: 'RESOURCE',
        title: 'House of Resources guide',
        description: 'Support information',
        cityName: 'Stuttgart',
        resourceType: 'COMMUNITY_RESOURCE',
        scope: 'CITY',
        scopeRegion: 'stuttgart',
        audiences: ['FOUNDER'],
        lifecycleStage: ['ANYTIME'],
        url: null,
        validUntil: null,
        isOfficialSource: true,
        confidence: 0.95,
        fieldConfidence: {},
      },
      sourceUrl: 'https://house-of-resources-stuttgart.de/support',
    });

    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.canonicalUrl).toBe('https://house-of-resources-stuttgart.de/support');
      expect(result.assessment.tier).toBe('institutional_directory');
    }
  });
});
