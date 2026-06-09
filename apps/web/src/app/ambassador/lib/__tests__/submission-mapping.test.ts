import { describe, expect, it } from 'vitest';
import {
  buildAmbassadorCommunityExtractedData,
  buildAmbassadorEventExtractedData,
} from '../submission-mapping';

describe('ambassador submission mapping', () => {
  it('builds canonical event extracted data', () => {
    const extracted = buildAmbassadorEventExtractedData({
      title: 'Diwali Night',
      description: 'Community celebration',
      date: '2026-11-07',
      time: '18:00',
      endDate: '2026-11-07',
      endTime: '22:00',
      venueName: 'Cultural Hall',
      venueAddress: '123 Main St',
      cityName: 'Stuttgart',
      isOnline: false,
      isFree: false,
      cost: '€12',
      registrationUrl: 'https://example.com/register',
      hostCommunity: 'Tamil Sangam',
      categories: ['culture', 'music', 'culture'],
      languages: ['Tamil', 'English', 'Unknown'],
    });

    expect(extracted).toMatchObject({
      type: 'EVENT',
      title: 'Diwali Night',
      date: '2026-11-07',
      time: '18:00',
      endTime: '22:00',
      venueName: 'Cultural Hall',
      venueAddress: '123 Main St',
      cityName: 'Stuttgart',
      isOnline: false,
      isFree: false,
      cost: '€12',
      registrationUrl: 'https://example.com/register',
      hostCommunity: 'Tamil Sangam',
      categories: ['culture', 'music'],
      languages: ['Tamil', 'English'],
      confidence: 0.75,
    });
    expect(extracted.fieldConfidence.title).toBe(0.9);
    expect(extracted.fieldConfidence.imageUrl).toBe(0.45);
  });

  it('maps community channel types into canonical extracted data', () => {
    const { extracted, supplementalChannels } = buildAmbassadorCommunityExtractedData({
      name: 'Berlin Malayali Club',
      description: 'Meetups and cultural programs',
      cityName: 'Berlin',
      categories: ['family', 'culture'],
      languages: ['Malayalam', 'English'],
      channelType: 'WHATSAPP',
      channelValue: 'https://chat.whatsapp.com/example',
      contactEmail: '',
    });

    expect(extracted).toMatchObject({
      type: 'COMMUNITY',
      name: 'Berlin Malayali Club',
      cityName: 'Berlin',
      whatsappUrl: 'https://chat.whatsapp.com/example',
      categories: ['family', 'culture'],
      languages: ['Malayalam', 'English'],
      confidence: 0.75,
    });
    expect(supplementalChannels).toEqual([]);
  });

  it('preserves unsupported community channel types in supplemental metadata', () => {
    const { extracted, supplementalChannels } = buildAmbassadorCommunityExtractedData({
      name: 'LinkedIn Network',
      cityName: 'Munich',
      categories: [],
      languages: [],
      channelType: 'LINKEDIN',
      channelValue: 'https://linkedin.com/company/example',
      contactEmail: 'hello@example.com',
    });

    expect(extracted.contactEmail).toBe('hello@example.com');
    expect(extracted.websiteUrl).toBeNull();
    expect(supplementalChannels).toEqual([
      { type: 'LINKEDIN', value: 'https://linkedin.com/company/example' },
    ]);
  });
});
