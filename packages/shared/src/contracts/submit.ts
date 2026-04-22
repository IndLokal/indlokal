import { z } from 'zod';

// ─── Allowed upload content-types ─────────────────────────────────────────

export const UploadContentType = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
export type UploadContentType = z.infer<typeof UploadContentType>;

// ─── Presign ──────────────────────────────────────────────────────────────

export const PresignRequest = z.object({
  contentType: UploadContentType,
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024), // max 10 MB
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a hex-encoded SHA-256 hash'),
});
export type PresignRequest = z.infer<typeof PresignRequest>;

export const PresignResponse = z.object({
  url: z.string().url(),
  key: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
});
export type PresignResponse = z.infer<typeof PresignResponse>;

// ─── Submission result ─────────────────────────────────────────────────────

export const SubmissionStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'MERGED']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const SubmissionResult = z.object({
  id: z.string(),
  entityType: z.enum(['EVENT', 'COMMUNITY']),
  status: SubmissionStatus,
  createdAt: z.string().datetime({ offset: true }),
});
export type SubmissionResult = z.infer<typeof SubmissionResult>;

// ─── Event submission ──────────────────────────────────────────────────────

export const EventSubmission = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  citySlug: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  venueName: z.string().max(200).optional(),
  venueAddress: z.string().max(500).optional(),
  isOnline: z.boolean().optional().default(false),
  cost: z.string().max(100).optional(),
  imageKey: z.string().optional(),
  categorySlugx: z.array(z.string()).max(5).optional(),
  communitySlug: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().max(200).optional(),
});
export type EventSubmission = z.infer<typeof EventSubmission>;

// ─── Community submission ──────────────────────────────────────────────────

export const ChannelSubmission = z.object({
  channelType: z.string().min(1),
  url: z.string().url(),
  isPrimary: z.boolean().optional().default(false),
});

export const CommunitySubmission = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10).max(2000),
  citySlug: z.string().min(1),
  categories: z.array(z.string()).min(1).max(20),
  languages: z.array(z.string()).max(20).optional().default([]),
  primaryChannelType: z.string().min(1),
  primaryChannelUrl: z.string().url(),
  secondaryChannelType: z.string().optional(),
  secondaryChannelUrl: z.string().url().optional().or(z.literal('')),
  contactEmail: z.string().email(),
  contactName: z.string().min(1).max(200),
  imageKey: z.string().optional(),
});
export type CommunitySubmission = z.infer<typeof CommunitySubmission>;

// ─── Suggest community submission ─────────────────────────────────────────

export const SuggestSubmission = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  citySlug: z.string().min(1),
  contactEmail: z.string().email().optional(),
  note: z.string().max(500).optional(),
});
export type SuggestSubmission = z.infer<typeof SuggestSubmission>;
