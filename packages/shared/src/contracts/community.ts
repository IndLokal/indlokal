/**
 * Community-detail contracts — TDD-0006.
 */

import { z } from 'zod';
import { Cuid, IsoDateTime } from './common';
import { CommunityStatus, ClaimState, CityRef, CategoryRef } from './discovery';
import { TrustSignalType } from './events';

// ─── Access channels ──────────────────────────────────────────────────────

export const ChannelType = z.enum([
  'WHATSAPP',
  'TELEGRAM',
  'WEBSITE',
  'FACEBOOK',
  'INSTAGRAM',
  'EMAIL',
  'MEETUP',
  'YOUTUBE',
  'LINKEDIN',
  'OTHER',
]);
export type ChannelType = z.infer<typeof ChannelType>;

export const AccessChannel = z.object({
  id: Cuid,
  channelType: ChannelType,
  url: z.string(),
  label: z.string().nullable(),
  isPrimary: z.boolean(),
  isVerified: z.boolean(),
});
export type AccessChannel = z.infer<typeof AccessChannel>;

// ─── Trust signal (community-scoped) ─────────────────────────────────────

export const TrustSignal = z.object({
  id: Cuid,
  signalType: TrustSignalType,
  createdAt: IsoDateTime,
});
export type TrustSignal = z.infer<typeof TrustSignal>;

// ─── Community detail ─────────────────────────────────────────────────────

export const CommunityDetail = z.object({
  id: Cuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  descriptionLong: z.string().nullable(),
  status: CommunityStatus,
  claimState: ClaimState,
  logoUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  personaSegments: z.array(z.string()),
  languages: z.array(z.string()),
  foundedYear: z.number().int().nullable(),
  memberCountApprox: z.number().int().nullable(),
  activityScore: z.number(),
  completenessScore: z.number(),
  trustScore: z.number(),
  isTrending: z.boolean(),
  lastActivityAt: IsoDateTime.nullable(),
  city: CityRef,
  categories: z.array(z.object({ category: CategoryRef })),
  accessChannels: z.array(AccessChannel),
  trustSignals: z.array(TrustSignal),
  upcomingEventCount: z.number().int(),
});
export type CommunityDetail = z.infer<typeof CommunityDetail>;

// ─── Community summary (lightweight — used in related rail) ──────────────

export const CommunitySummary = z.object({
  id: Cuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  memberCountApprox: z.number().int().nullable(),
  city: CityRef,
  categories: z.array(z.object({ category: CategoryRef })),
  upcomingEventCount: z.number().int(),
});
export type CommunitySummary = z.infer<typeof CommunitySummary>;

// ─── Follow state ─────────────────────────────────────────────────────────

export const FollowState = z.object({ followed: z.boolean() });
export type FollowState = z.infer<typeof FollowState>;
