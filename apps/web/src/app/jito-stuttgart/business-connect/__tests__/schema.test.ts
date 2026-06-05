import { describe, expect, it } from 'vitest';
import { businessConnectSubmissionSchema } from '../schema';

/**
 * Validation contract for the Business Connect pilot intake. This is the engine's
 * server-side guard (the submit action parses with this schema), so it is
 * deliberately pilot-agnostic — no pilot identity is validated here.
 */

const validInput = () => ({
  participantType: 'INDIAN_BUSINESS',
  lookingFor: ['DISTRIBUTOR'],
  offering: ['PRODUCT'],
  companyName: 'Acme GmbH',
  country: 'Germany',
  city: 'Stuttgart',
  industry: 'Manufacturing',
  businessDescription: 'We build precision components for the automotive sector.',
  specificAsk: 'Looking for a distribution partner in India.',
  contactName: 'Asha Rao',
  contactEmail: 'Asha@Example.com',
  attendingEvent: 'YES',
  isPartnerMember: 'NO',
  consentToReview: true,
  consentManualIntroUnderstanding: true,
  consentToShareSelectedInfo: false,
});

describe('businessConnectSubmissionSchema', () => {
  it('accepts a complete, valid enquiry', () => {
    const result = businessConnectSubmissionSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('defaults consentToShareSelectedInfo to false when omitted', () => {
    const { consentToShareSelectedInfo: _omit, ...rest } = validInput();
    const result = businessConnectSubmissionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consentToShareSelectedInfo).toBe(false);
    }
  });

  it('rejects a missing mandatory review consent', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      consentToReview: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.consentToReview).toBeDefined();
    }
  });

  it('rejects an invalid contact email', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      contactEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.contactEmail).toBeDefined();
    }
  });

  it('requires at least one "looking for" and one "offering" option', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      lookingFor: [],
      offering: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.lookingFor).toBeDefined();
      expect(errors.offering).toBeDefined();
    }
  });

  it('requires the membership answer to be a known value', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      isPartnerMember: 'MAYBE',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.isPartnerMember).toBeDefined();
    }
  });

  it('requires free text when "OTHER" is selected for lookingFor', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      lookingFor: ['OTHER'],
      lookingForOther: '   ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.lookingForOther).toBeDefined();
    }
  });

  it('requires free text when "OTHER" is selected for offering', () => {
    const result = businessConnectSubmissionSchema.safeParse({
      ...validInput(),
      offering: ['OTHER'],
      offeringOther: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.offeringOther).toBeDefined();
    }
  });
});
