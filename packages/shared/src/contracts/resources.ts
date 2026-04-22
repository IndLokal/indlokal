import { z } from 'zod';
import { Cuid, IsoDateTime, Page } from './common.js';

// ─── ResourceType ─────────────────────────────────────────────────────────

export const ResourceType = z.enum([
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
  'CITY_REGISTRATION',
  'DRIVING',
  'HOUSING',
  'HEALTH_DOCTORS',
  'FAMILY_CHILDREN',
  'JOBS_CAREERS',
  'TAX_FINANCE',
  'BUSINESS_SETUP',
  'GROCERY_FOOD',
  'COMMUNITY_RESOURCE',
]);
export type ResourceType = z.infer<typeof ResourceType>;

// ─── Resource ─────────────────────────────────────────────────────────────

export const Resource = z.object({
  id: Cuid,
  title: z.string(),
  slug: z.string(),
  resourceType: ResourceType,
  url: z.string().url().nullable(),
  description: z.string().nullable(),
  validFrom: IsoDateTime.nullable(),
  validUntil: IsoDateTime.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: IsoDateTime,
});
export type Resource = z.infer<typeof Resource>;

// ─── ReportType ───────────────────────────────────────────────────────────

export const ReportType = z.enum([
  'STALE_INFO',
  'BROKEN_LINK',
  'INCORRECT_DETAILS',
  'SUGGEST_COMMUNITY',
  'OTHER',
]);
export type ReportType = z.infer<typeof ReportType>;

export const ReportStatus = z.enum(['PENDING', 'REVIEWED', 'RESOLVED']);
export type ReportStatus = z.infer<typeof ReportStatus>;

// ─── ContentReportInput ───────────────────────────────────────────────────

export const ContentReportInput = z.object({
  reportType: ReportType,
  /** ID of the community being reported (for STALE_INFO, BROKEN_LINK, INCORRECT_DETAILS) */
  communityId: Cuid.optional(),
  /** Free-text name for SUGGEST_COMMUNITY */
  suggestedName: z.string().max(200).optional(),
  /** City for SUGGEST_COMMUNITY */
  citySlug: z.string().optional(),
  /** Additional detail the reporter wants to share */
  details: z.string().max(2000).optional(),
  /** Reporter's email (for follow-up) */
  reporterEmail: z.string().email().optional(),
});
export type ContentReportInput = z.infer<typeof ContentReportInput>;

// ─── ContentReport (response) ─────────────────────────────────────────────

export const ContentReport = z.object({
  id: Cuid,
  reportType: ReportType,
  status: ReportStatus,
  createdAt: IsoDateTime,
});
export type ContentReport = z.infer<typeof ContentReport>;

// ─── Paginated saves response types ──────────────────────────────────────

/** Minimal event shape returned in saved events list */
export const SavedEventItem = z.object({
  id: Cuid,
  title: z.string(),
  slug: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  venueName: z.string().nullable(),
  isOnline: z.boolean(),
  savedAt: IsoDateTime,
  city: z.object({ name: z.string(), slug: z.string() }),
});
export type SavedEventItem = z.infer<typeof SavedEventItem>;

export const SavedEventsPage = Page(SavedEventItem);
export type SavedEventsPage = z.infer<typeof SavedEventsPage>;

/** Minimal community shape returned in saved communities list */
export const SavedCommunityItem = z.object({
  id: Cuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  memberCountApprox: z.number().int().nullable(),
  savedAt: IsoDateTime,
  city: z.object({ name: z.string(), slug: z.string() }),
});
export type SavedCommunityItem = z.infer<typeof SavedCommunityItem>;

export const SavedCommunitiesPage = Page(SavedCommunityItem);
export type SavedCommunitiesPage = z.infer<typeof SavedCommunitiesPage>;
