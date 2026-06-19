import { describe, expect, it } from 'vitest';
import { normalizeParsedItemForTest } from '../llm';

describe('pipeline pricing/access derivation', () => {
  const base = {
    type: 'EVENT',
    index: 0,
    title: 'Test Event',
    description: '',
    date: '2026-07-01',
    time: '18:00',
    endDate: null,
    endTime: null,
    venueName: 'Test Venue',
    venueAddress: null,
    cityName: 'Stuttgart',
    isOnline: false,
    categories: ['cultural'],
    languages: ['en'],
    confidence: 0.9,
    fieldConfidence: {},
    hostCommunity: null,
    imageUrl: null,
  };

  it('maps isFree=true to costType=FREE, accessType=UNCLEAR', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: true, cost: null, registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'FREE',
      accessType: 'UNCLEAR',
      requiresRegistration: false,
      requiresApproval: false,
    });
  });

  it('maps isFree=false to costType=PAID', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: false, cost: '€10', registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'PAID',
      priceAmount: 10,
      priceCurrency: '€',
    });
  });

  it('maps cost="kostenlos" to costType=FREE', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: null, cost: 'kostenlos', registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({ costType: 'FREE' });
  });

  it('maps numeric price in cost string to PAID with parsed amount', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: null, cost: '€25 per person', registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'PAID',
      priceAmount: 25,
      priceCurrency: '€',
    });
  });

  it('maps registrationUrl to requiresRegistration=true and accessType=REGISTRATION_REQUIRED', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: true, cost: null, registrationUrl: 'https://eventbrite.com/register' },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'FREE',
      accessType: 'REGISTRATION_REQUIRED',
      requiresRegistration: true,
    });
  });

  it('detects APPROVAL_REQUIRED from description keywords', () => {
    const result = normalizeParsedItemForTest(
      {
        ...base,
        isFree: true,
        cost: null,
        registrationUrl: null,
        description: 'Selected participants will be notified after approval',
      },
      0,
      1,
    );
    expect(result).toMatchObject({
      accessType: 'APPROVAL_REQUIRED',
      requiresRegistration: true,
      requiresApproval: true,
    });
  });

  it('detects INVITE_ONLY from cost string', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: null, cost: 'invite-only event', registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      accessType: 'INVITE_ONLY',
    });
  });

  it('detects MEMBERS_ONLY from description', () => {
    const result = normalizeParsedItemForTest(
      {
        ...base,
        isFree: true,
        cost: null,
        registrationUrl: null,
        description: 'This event is for members only',
      },
      0,
      1,
    );
    expect(result).toMatchObject({
      accessType: 'MEMBERS_ONLY',
    });
  });

  it('never infers OPEN_ENTRY from FREE alone', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: true, cost: 'free', registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'FREE',
      accessType: 'UNCLEAR', // never OPEN_ENTRY from free alone
    });
  });

  it('maps null cost and null isFree to UNCLEAR', () => {
    const result = normalizeParsedItemForTest(
      { ...base, isFree: null, cost: null, registrationUrl: null },
      0,
      1,
    );
    expect(result).toMatchObject({
      costType: 'UNCLEAR',
      accessType: 'UNCLEAR',
    });
  });

  it('maps "Anmeldung erforderlich" in description to REGISTRATION_REQUIRED', () => {
    const result = normalizeParsedItemForTest(
      {
        ...base,
        isFree: true,
        cost: null,
        registrationUrl: null,
        description: 'Anmeldung erforderlich auf unserer Webseite',
      },
      0,
      1,
    );
    expect(result).toMatchObject({
      accessType: 'REGISTRATION_REQUIRED',
      requiresRegistration: true,
    });
  });
});
