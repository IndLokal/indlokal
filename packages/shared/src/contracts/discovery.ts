/**
 * Discovery contracts — TDD-0003.
 *
 * Covers the city list, city detail, and per-city discovery feed
 * endpoints (/api/v1/cities and /api/v1/discovery/:citySlug/*).
 * All endpoints are public (no auth required).
 */

import { z } from 'zod';
import { Cuid, IsoDateTime, Page } from './common.js';

// ─── City ──────────────────────────────────────────────────────────────────

export const City = z.object({
  id: Cuid,
  name: z.string(),
  slug: z.string(),
  state: z.string(),
  country: z.string(),
  isActive: z.boolean(),
  isMetroPrimary: z.boolean(),
  timezone: z.string(),
  diasporaDensityEstimate: z.number().int().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
export type City = z.infer<typeof City>;

export const CategorySummary = z.object({
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
  communityCount: z.number().int(),
});
export type CategorySummary = z.infer<typeof CategorySummary>;

export const CityCounts = z.object({
  communities: z.number().int(),
  upcomingEvents: z.number().int(),
  categories: z.number().int(),
});
export type CityCounts = z.infer<typeof CityCounts>;

export const CityDetail = City.extend({
  counts: CityCounts,
  categories: z.array(CategorySummary),
});
export type CityDetail = z.infer<typeof CityDetail>;

// ─── Shared refs ───────────────────────────────────────────────────────────

export const CommunityRef = z.object({ name: z.string(), slug: z.string() });
export type CommunityRef = z.infer<typeof CommunityRef>;

export const CityRef = z.object({ name: z.string(), slug: z.string() });
export type CityRef = z.infer<typeof CityRef>;

export const CategoryRef = z.object({
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
});
export type CategoryRef = z.infer<typeof CategoryRef>;

// ─── Event card ────────────────────────────────────────────────────────────

export const EventCard = z.object({
  id: Cuid,
  title: z.string(),
  slug: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  venueName: z.string().nullable(),
  isOnline: z.boolean(),
  cost: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isRecurring: z.boolean(),
  community: CommunityRef.nullable(),
  city: CityRef,
  categories: z.array(z.object({ category: CategoryRef })),
});
export type EventCard = z.infer<typeof EventCard>;

export const EventsQuery = z.object({
  from: IsoDateTime.optional(),
  to: IsoDateTime.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  categorySlug: z.string().optional(),
});
export type EventsQuery = z.infer<typeof EventsQuery>;

export const EventsPage = Page(EventCard);
export type EventsPage = z.infer<typeof EventsPage>;

// ─── Community card ────────────────────────────────────────────────────────

export const CommunityStatus = z.enum(['ACTIVE', 'INACTIVE', 'UNVERIFIED', 'CLAIMED']);
export type CommunityStatus = z.infer<typeof CommunityStatus>;

export const ClaimState = z.enum(['UNCLAIMED', 'CLAIM_PENDING', 'CLAIMED']);
export type ClaimState = z.infer<typeof ClaimState>;

export const CommunityCard = z.object({
  id: Cuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: CommunityStatus,
  activityScore: z.number(),
  completenessScore: z.number(),
  trustScore: z.number(),
  isTrending: z.boolean(),
  claimState: ClaimState,
  memberCountApprox: z.number().int().nullable(),
  logoUrl: z.string().nullable(),
  lastActivityAt: IsoDateTime.nullable(),
  languages: z.array(z.string()),
  city: CityRef,
  categories: z.array(z.object({ category: CategoryRef })),
  upcomingEventCount: z.number().int(),
});
export type CommunityCard = z.infer<typeof CommunityCard>;

export const CommunitiesQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  categorySlug: z.string().optional(),
});
export type CommunitiesQuery = z.infer<typeof CommunitiesQuery>;

export const CommunitiesPage = Page(CommunityCard);
export type CommunitiesPage = z.infer<typeof CommunitiesPage>;

// ─── Trending ──────────────────────────────────────────────────────────────

export const TrendingResponse = z.object({
  communities: z.array(CommunityCard),
  events: z.array(EventCard),
  categories: z.array(CategorySummary),
});
export type TrendingResponse = z.infer<typeof TrendingResponse>;
