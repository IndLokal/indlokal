import { describe, expect, it } from 'vitest';
import { normalizeParsedItemForTest } from '../extraction';

describe('normalizeParsedItemForTest', () => {
  it('coerces mixed community-shaped event payloads into events', () => {
    const normalized = normalizeParsedItemForTest(
      {
        type: 'COMMUNITY',
        index: 4,
        name: 'SAMAIKYA TELUGU VEDIKA e.V',
        title: 'JITO Stuttgart Tech Summit',
        description: 'Event Registration: JITO Stuttgart Tech Summit – 22nd June 2026',
        date: '2026-06-22',
        time: '11:00',
        endDate: '2026-06-22',
        endTime: '16:00',
        cityName: 'Stuttgart',
        venueName: 'HK Region Stuttgart',
        venueAddress: 'Jagerstrasse 30, 70174 Stuttgart',
        registrationUrl: 'https://jitostuttgart.de/jito-stuttgart-summit-2026/',
        categories: ['professional', 'networking-social'],
        confidence: 0.95,
      },
      0,
      5,
    );

    expect(normalized).toMatchObject({
      type: 'EVENT',
      title: 'JITO Stuttgart Tech Summit',
      date: '2026-06-22',
      registrationUrl: 'https://jitostuttgart.de/jito-stuttgart-summit-2026/',
      sourceIndex: 4,
    });
  });

  it('keeps genuine community payloads as communities', () => {
    const normalized = normalizeParsedItemForTest(
      {
        type: 'COMMUNITY',
        index: 2,
        name: 'JITO Stuttgart',
        description: 'Networking and mentorship community for Jain professionals in Stuttgart.',
        cityName: 'Stuttgart',
        websiteUrl: 'https://jitostuttgart.de/',
        categories: ['professional'],
        confidence: 0.9,
      },
      0,
      3,
    );

    expect(normalized).toMatchObject({
      type: 'COMMUNITY',
      name: 'JITO Stuttgart',
      cityName: 'Stuttgart',
      sourceIndex: 2,
    });
  });

  it('maps relative LLM indices back to absolute source indices inside extraction batches', () => {
    const normalized = normalizeParsedItemForTest(
      {
        type: 'EVENT',
        index: 1,
        title: 'JITO Stuttgart Tech Summit',
        date: '2026-06-22',
        cityName: 'Stuttgart',
        registrationUrl: 'https://jitostuttgart.de/jito-stuttgart-summit-2026/',
        confidence: 0.9,
      },
      23,
      3,
    );

    expect(normalized).toMatchObject({
      type: 'EVENT',
      title: 'JITO Stuttgart Tech Summit',
      sourceIndex: 24,
    });
  });

  it('keeps absolute LLM indices unchanged inside extraction batches', () => {
    const normalized = normalizeParsedItemForTest(
      {
        type: 'EVENT',
        index: 24,
        title: 'JITO Stuttgart Tech Summit',
        date: '2026-06-22',
        cityName: 'Stuttgart',
        registrationUrl: 'https://jitostuttgart.de/jito-stuttgart-summit-2026/',
        confidence: 0.9,
      },
      23,
      3,
    );

    expect(normalized.sourceIndex).toBe(24);
  });
});
