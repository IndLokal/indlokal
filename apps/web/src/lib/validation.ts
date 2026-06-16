import { z } from 'zod';
import { communityOptions } from '@indlokal/shared';
import {
  communityDescriptionSchema,
  communityLanguagesSchema,
  communityNameSchema,
} from '@/lib/communities/form-input';

const normalizeUrl = (value: string) => value.trim().toLowerCase().replace(/\/$/, '');

const submitChannelSchema = z.object({
  channelType: z.enum(communityOptions.CHANNEL_TYPE_VALUES),
  url: z.string().url('Please enter a valid URL'),
  label: z.string().max(100).optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

const claimEvidenceSchema = z.object({
  type: z.enum(communityOptions.CHANNEL_TYPE_VALUES),
  url: z.string().url('Please enter a valid URL'),
});

export const submitCommunitySchema = z
  .object({
    name: communityNameSchema,
    description: communityDescriptionSchema,
    citySlug: z.string().min(1, 'Please select a city'),
    categories: z.array(z.string()).min(1, 'Select at least one category').max(20),
    languages: communityLanguagesSchema,
    channels: z.array(submitChannelSchema).min(1, 'Add at least one channel').max(6),
    // PRD/TDD-0036: submitter declares their relationship to the community.
    // HELP_RUN -> eligible for organizer ownership on approval; JUST_ADDING ->
    // listing only, no ownership.
    relationship: z.enum(['HELP_RUN', 'JUST_ADDING']).default('JUST_ADDING'),
    contactEmail: z.string().email('Please enter a valid email'),
    contactName: z.string().min(1, 'Please enter your name'),
  })
  .superRefine((data, ctx) => {
    const primaryCount = data.channels.filter((channel) => channel.isPrimary).length;
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['channels'],
        message: 'Select exactly one primary channel.',
      });
    }

    const dedupe = new Set<string>();
    for (const channel of data.channels) {
      const key = `${channel.channelType}:${normalizeUrl(channel.url)}`;
      if (dedupe.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['channels'],
          message: 'Duplicate channel links are not allowed.',
        });
        break;
      }
      dedupe.add(key);
    }
  });

export type SubmitCommunityInput = z.infer<typeof submitCommunitySchema>;

export const claimCommunitySchema = z
  .object({
    communityId: z.string().min(1),
    email: z.string().email('Please enter a valid email'),
    name: z.string().min(1, 'Please enter your name'),
    relationship: z.enum(['organizer', 'co-organizer', 'admin', 'member']),
    message: z.string().max(500).optional().default(''),
    evidenceLinks: z.array(claimEvidenceSchema).max(5).default([]),
    // Legacy fields kept temporarily for backward compatibility.
    whatsappUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
    telegramUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
    socialUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    const seenTypes = new Set<string>();
    for (const evidence of data.evidenceLinks) {
      if (seenTypes.has(evidence.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidenceLinks'],
          message: 'Evidence types must be unique.',
        });
        break;
      }
      seenTypes.add(evidence.type);
    }
  });

export type ClaimCommunityInput = z.infer<typeof claimCommunitySchema>;

// ─── Suggestion Schemas ──────────────────────────────────────────────────

export const suggestCommunitySchema = z.object({
  suggestedName: z
    .string()
    .min(2, 'Community name must be at least 2 characters')
    .max(150, 'Name too long'),
  citySlug: z.string().min(1, 'City is required'),
  whatDoesItDo: z.string().max(500, 'Description too long').optional(),
  howToJoin: z.string().max(300, 'How to join info too long').optional(),
  reporterEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
});

export type SuggestCommunityInput = z.infer<typeof suggestCommunitySchema>;

export const contributeEventSchema = z.object({
  eventTitle: z
    .string()
    .min(3, 'Event title must be at least 3 characters')
    .max(150, 'Title too long'),
  citySlug: z.string().min(1, 'City is required'),
  eventDate: z.coerce.date().min(new Date(), 'Event date must be in the future'),
  eventTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format')
    .optional()
    .or(z.literal('')),
  venue: z.string().max(200, 'Venue too long').optional(),
  category: z
    .enum([
      'MUSIC',
      'ART',
      'TECH',
      'LANGUAGE',
      'SOCIAL',
      'PROFESSIONAL',
      'CULTURAL',
      'SPORTS',
      'FOOD',
      'OTHER',
    ])
    .optional(),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  reporterEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
});

export type ContributeEventInput = z.infer<typeof contributeEventSchema>;
