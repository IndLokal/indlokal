import { describe, it, expect } from 'vitest';
import {
  formatCostLabel,
  formatAccessLabel,
  formatEventPricingLabel,
  formatCostBadge,
} from '@indlokal/shared/content/event-pricing';

describe('formatCostLabel', () => {
  it('returns "Free" for FREE costType', () => {
    expect(
      formatCostLabel({ costType: 'FREE', priceAmount: null, priceCurrency: null, costNote: null }),
    ).toBe('Free');
  });

  it('returns formatted price for PAID with amount', () => {
    expect(
      formatCostLabel({ costType: 'PAID', priceAmount: 25, priceCurrency: '€', costNote: null }),
    ).toBe('€25');
  });

  it('returns costNote for PAID without amount', () => {
    expect(
      formatCostLabel({
        costType: 'PAID',
        priceAmount: null,
        priceCurrency: null,
        costNote: 'Donation suggested',
      }),
    ).toBe('Donation suggested');
  });

  it('returns "Paid" for PAID with no amount or note', () => {
    expect(
      formatCostLabel({ costType: 'PAID', priceAmount: null, priceCurrency: null, costNote: null }),
    ).toBe('Paid');
  });

  it('returns "Cost unclear" for UNCLEAR costType', () => {
    expect(
      formatCostLabel({
        costType: 'UNCLEAR',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
      }),
    ).toBe('Cost unclear');
  });
});

describe('formatAccessLabel', () => {
  it('returns "Open entry" for OPEN_ENTRY', () => {
    expect(formatAccessLabel({ accessType: 'OPEN_ENTRY', entryNote: null })).toBe('Open entry');
  });

  it('returns "Registration required" for REGISTRATION_REQUIRED', () => {
    expect(formatAccessLabel({ accessType: 'REGISTRATION_REQUIRED', entryNote: null })).toBe(
      'Registration required',
    );
  });

  it('returns "Selected participants only" for APPROVAL_REQUIRED', () => {
    expect(formatAccessLabel({ accessType: 'APPROVAL_REQUIRED', entryNote: null })).toBe(
      'Selected participants only',
    );
  });

  it('returns "Invite only" for INVITE_ONLY', () => {
    expect(formatAccessLabel({ accessType: 'INVITE_ONLY', entryNote: null })).toBe('Invite only');
  });

  it('returns "Members only" for MEMBERS_ONLY', () => {
    expect(formatAccessLabel({ accessType: 'MEMBERS_ONLY', entryNote: null })).toBe('Members only');
  });

  it('returns entryNote for UNCLEAR if provided', () => {
    expect(formatAccessLabel({ accessType: 'UNCLEAR', entryNote: 'Contact organizer' })).toBe(
      'Contact organizer',
    );
  });

  it('returns default for UNCLEAR with no note', () => {
    expect(formatAccessLabel({ accessType: 'UNCLEAR', entryNote: null })).toBe(
      'Entry rules unclear',
    );
  });
});

describe('formatEventPricingLabel', () => {
  it('formats free + open entry', () => {
    expect(
      formatEventPricingLabel({
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'OPEN_ENTRY',
        entryNote: null,
      }),
    ).toBe('Free · Open entry');
  });

  it('formats free + registration required', () => {
    expect(
      formatEventPricingLabel({
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'REGISTRATION_REQUIRED',
        entryNote: null,
      }),
    ).toBe('Free · Registration required');
  });

  it('formats free + selected participants', () => {
    expect(
      formatEventPricingLabel({
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'APPROVAL_REQUIRED',
        entryNote: null,
      }),
    ).toBe('Free · Selected participants only');
  });

  it('formats paid + registration required', () => {
    expect(
      formatEventPricingLabel({
        costType: 'PAID',
        priceAmount: 25,
        priceCurrency: '€',
        costNote: null,
        accessType: 'REGISTRATION_REQUIRED',
        entryNote: null,
      }),
    ).toBe('€25 · Registration required');
  });

  it('formats unclear + unclear', () => {
    expect(
      formatEventPricingLabel({
        costType: 'UNCLEAR',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'UNCLEAR',
        entryNote: null,
      }),
    ).toBe('Cost unclear · Entry rules unclear');
  });
});

describe('formatCostBadge', () => {
  it('uses structured fields when costType is not UNCLEAR', () => {
    expect(
      formatCostBadge({
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: 'free',
      }),
    ).toBe('Free');
  });

  it('preserves legacy paid text when PAID has no structured amount or note', () => {
    expect(
      formatCostBadge({
        costType: 'PAID',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: '€25 early bird',
      }),
    ).toBe('€25 early bird');
  });

  it('normalizes legacy paid string when PAID has no structured amount or note', () => {
    expect(
      formatCostBadge({
        costType: 'PAID',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: 'paid',
      }),
    ).toBe('Paid');
  });

  it('falls back to legacy cost when costType is UNCLEAR and cost is present', () => {
    expect(
      formatCostBadge({
        costType: 'UNCLEAR',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: '€15 early bird',
      }),
    ).toBe('€15 early bird');
  });

  it('handles legacy free string', () => {
    expect(
      formatCostBadge({
        costType: 'UNCLEAR',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: 'free',
      }),
    ).toBe('Free');
  });

  it('handles legacy unclear string', () => {
    expect(
      formatCostBadge({
        costType: 'UNCLEAR',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        cost: 'unclear',
      }),
    ).toBe('Cost unclear');
  });
});
