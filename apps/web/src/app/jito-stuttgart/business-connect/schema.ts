import { z } from 'zod';
import {
  LOOKING_FOR_VALUES,
  OFFERING_VALUES,
  PARTICIPANT_TYPE_VALUES,
  YES_NO_NOT_SURE_VALUES,
} from './options';

const trimmedString = (max: number) => z.string().trim().max(max);

/**
 * Validation for a Business Connect pilot enquiry. Required fields must be
 * non-empty, email must be valid, free-text has sensible max lengths, and the
 * two mandatory consent checkboxes must be explicitly true.
 */
export const businessConnectSubmissionSchema = z
  .object({
    participantType: z.enum(PARTICIPANT_TYPE_VALUES as [string, ...string[]], {
      message: 'Please select what best describes you',
    }),

    lookingFor: z
      .array(z.enum(LOOKING_FOR_VALUES as [string, ...string[]]))
      .min(1, 'Select at least one option')
      .max(LOOKING_FOR_VALUES.length),
    lookingForOther: trimmedString(200).optional().or(z.literal('')),

    offering: z
      .array(z.enum(OFFERING_VALUES as [string, ...string[]]))
      .min(1, 'Select at least one option')
      .max(OFFERING_VALUES.length),
    offeringOther: trimmedString(200).optional().or(z.literal('')),

    companyName: z.string().trim().min(1, 'Company / organization name is required').max(200),
    country: z.string().trim().min(1, 'Country is required').max(100),
    city: z.string().trim().min(1, 'City is required').max(100),
    industry: z.string().trim().min(1, 'Industry is required').max(120),
    businessDescription: z
      .string()
      .trim()
      .min(10, 'Please add a short description (at least 10 characters)')
      .max(1500),
    specificAsk: z.string().trim().min(5, 'Please describe what you are looking for').max(1500),
    contactName: z.string().trim().min(1, 'Contact person name is required').max(120),
    contactEmail: z.string().trim().email('Please enter a valid email'),

    website: z.string().trim().max(300).optional().or(z.literal('')),
    linkedinUrl: z.string().trim().max(300).optional().or(z.literal('')),
    phone: z.string().trim().max(60).optional().or(z.literal('')),
    preferredGeography: z.string().trim().max(200).optional().or(z.literal('')),

    attendingEvent: z.enum(YES_NO_NOT_SURE_VALUES as [string, ...string[]], {
      message: 'Please answer whether you are attending',
    }),
    isPartnerMember: z.enum(YES_NO_NOT_SURE_VALUES as [string, ...string[]], {
      message: 'Please answer the membership question',
    }),
    referredBy: z.string().trim().max(200).optional().or(z.literal('')),
    associatedChapterOrOrg: z.string().trim().max(200).optional().or(z.literal('')),

    consentToReview: z.literal(true, {
      message: 'This consent is required to submit',
    }),
    consentManualIntroUnderstanding: z.literal(true, {
      message: 'Please acknowledge that introductions are manually reviewed',
    }),
    consentToShareSelectedInfo: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.lookingFor.includes('OTHER') && !data.lookingForOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lookingForOther'],
        message: 'Please describe what you are looking for',
      });
    }
    if (data.offering.includes('OTHER') && !data.offeringOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offeringOther'],
        message: 'Please describe what you can offer',
      });
    }
  });

export type BusinessConnectSubmissionInput = z.infer<typeof businessConnectSubmissionSchema>;
