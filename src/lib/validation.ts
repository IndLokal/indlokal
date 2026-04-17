import { z } from 'zod';
import { ChannelType } from '@prisma/client';

export const submitCommunitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  citySlug: z.string().min(1, 'Please select a city'),
  categories: z.array(z.string()).min(1, 'Select at least one category').max(20),
  languages: z.array(z.string()).max(20).default([]),
  primaryChannelType: z.nativeEnum(ChannelType),
  primaryChannelUrl: z.string().url('Please enter a valid URL'),
  secondaryChannelType: z.nativeEnum(ChannelType).optional(),
  secondaryChannelUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  contactEmail: z.string().email('Please enter a valid email'),
  contactName: z.string().min(1, 'Please enter your name'),
});

export type SubmitCommunityInput = z.infer<typeof submitCommunitySchema>;

export const claimCommunitySchema = z.object({
  communityId: z.string().min(1),
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(1, 'Please enter your name'),
  relationship: z.enum(['organizer', 'co-organizer', 'admin', 'member']),
  message: z.string().max(500).optional().default(''),
  whatsappUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  telegramUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  socialUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export type ClaimCommunityInput = z.infer<typeof claimCommunitySchema>;
