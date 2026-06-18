/**
 * Auth contracts - TDD-0001.
 *
 * NOTE: This file defines the *shapes* the API will use. Handlers
 * are not yet implemented (foundation-only PR per the agreed scope).
 * Each schema below maps 1:1 to a row in TDD-0001 §3 "API surface".
 */

import { z } from 'zod';
import { Ack, Cuid, IsoDateTime } from './common';

// ─── Profile returned by GET /api/v1/me ───

export const UserRole = z.enum([
  'USER',
  'COMMUNITY_ADMIN',
  'EVENT_HOST',
  'PARTNER_ORG_ADMIN',
  'CITY_AMBASSADOR',
  'CONTENT_EDITOR',
  'OPS_LEAD',
  'PARTNERSHIPS_LEAD',
  'PLATFORM_ADMIN',
]);
export type UserRole = z.infer<typeof UserRole>;

export const RoleAssignmentSummary = z.object({
  role: UserRole,
  cityId: Cuid.nullable(),
  orgId: Cuid.nullable(),
  revokedAt: IsoDateTime.nullable(),
});
export type RoleAssignmentSummary = z.infer<typeof RoleAssignmentSummary>;

export const ClaimedCommunitySummary = z.object({
  id: Cuid,
  claimedByUserId: Cuid.nullable(),
});
export type ClaimedCommunitySummary = z.infer<typeof ClaimedCommunitySummary>;

export const MeProfile = z.object({
  id: Cuid,
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: UserRole,
  cityId: Cuid.nullable(),
  cityName: z.string().nullable(),
  personaSegments: z.array(z.string()),
  preferredLanguages: z.array(z.string()),
  onboardingComplete: z.boolean(),
  roleAssignments: z.array(RoleAssignmentSummary),
  claimedCommunities: z.array(ClaimedCommunitySummary),
  createdAt: IsoDateTime,
  lastActiveAt: IsoDateTime.nullable(),
});
export type MeProfile = z.infer<typeof MeProfile>;

// ─── Token envelope returned by every auth-issuing endpoint ───

export const AuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: IsoDateTime,
  refreshExpiresAt: IsoDateTime,
  user: MeProfile,
});
export type AuthTokens = z.infer<typeof AuthTokens>;

// ─── POST /api/v1/auth/magic-link/request ───

export const MagicLinkRequest = z.object({
  email: z.string().email().max(254),
  /**
   * Where to redirect after verification. Mobile uses the
   * `indlokal://` custom scheme; web uses an absolute https URL.
   */
  redirectTo: z.string().max(500).optional(),
});
export type MagicLinkRequest = z.infer<typeof MagicLinkRequest>;

export const MagicLinkRequestResponse = Ack;
export type MagicLinkRequestResponse = z.infer<typeof MagicLinkRequestResponse>;

// ─── POST /api/v1/auth/magic-link/verify ───

export const MagicLinkVerify = z.object({
  token: z.string().min(1).max(500),
});
export type MagicLinkVerify = z.infer<typeof MagicLinkVerify>;

// ─── POST /api/v1/auth/google ───

export const GoogleAuth = z.object({
  /** Authorization code returned from Google OAuth flow. */
  code: z.string().min(1),
  /** PKCE code verifier (mobile required, web optional). */
  codeVerifier: z.string().min(1).optional(),
  /** Redirect URI used when obtaining the code. */
  redirectUri: z.string().url(),
});
export type GoogleAuth = z.infer<typeof GoogleAuth>;

// ─── POST /api/v1/auth/apple ───

export const AppleAuth = z.object({
  /** Apple identity token (JWT signed by Apple). */
  identityToken: z.string().min(1),
  /** Authorization code from Apple. */
  authorizationCode: z.string().min(1),
  /** First-time sign-in only - Apple sends user info once. */
  user: z
    .object({
      email: z.string().email().optional(),
      name: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
export type AppleAuth = z.infer<typeof AppleAuth>;

// ─── POST /api/v1/auth/refresh and /logout ───

export const RefreshRequest = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequest>;

// ─── POST /api/v1/auth/handoff - TDD-0058 (app → web hand-off) ───

/**
 * Request a one-time, short-lived URL that opens an authenticated web
 * session in an in-app browser. `next` is the in-product path to land on
 * after the web cookie session is established (server-validated; unsafe
 * values fall back to a safe default). No long-lived secret is returned.
 */
export const WebHandoffRequest = z.object({
  next: z.string().max(500).optional(),
});
export type WebHandoffRequest = z.infer<typeof WebHandoffRequest>;

export const WebHandoffResponse = z.object({
  /** Absolute https URL on the app origin, containing the one-time token. */
  url: z.string().url(),
  /** When the one-time token expires (clients should open promptly). */
  expiresAt: IsoDateTime,
});
export type WebHandoffResponse = z.infer<typeof WebHandoffResponse>;

// ─── Token claim shape (server-side, not exposed) ───
// Documented here so that both the issuer (apps/web) and any future
// consumer (mobile background workers) agree on the JWT payload.

export const AccessTokenClaims = z.object({
  sub: Cuid, // userId
  email: z.string().email(),
  role: UserRole,
  /** Identifier of the device/refresh-token chain that minted this access token. */
  jti: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.string(),
  aud: z.string(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;

// ─── PATCH /api/v1/me/onboarding - TDD-0019 ───

/**
 * Partial update accepted by PATCH /api/v1/me/onboarding.
 * All fields are optional; the handler applies only those present.
 * On success the server sets onboardingComplete = true.
 */
export const OnboardingUpdate = z.object({
  cityId: Cuid.optional(),
  displayName: z.string().min(1).max(80).trim().optional(),
  personaSegments: z.array(z.string().min(1).max(40)).max(10).optional(),
  preferredLanguages: z.array(z.string().min(2).max(10)).max(10).optional(),
});
export type OnboardingUpdate = z.infer<typeof OnboardingUpdate>;

// ─── GET /api/v1/me/export - GDPR portability payload ───

const ExportCitySummary = z.object({
  id: Cuid,
  slug: z.string(),
  name: z.string(),
});

const ExportCommunitySummary = z.object({
  id: Cuid,
  slug: z.string(),
  name: z.string(),
  city: ExportCitySummary.nullable(),
});

const ExportEventSummary = z.object({
  id: Cuid,
  slug: z.string(),
  title: z.string(),
  startsAt: IsoDateTime,
  status: z.string(),
  moderationState: z.string(),
  city: ExportCitySummary.nullable(),
});

const ExportResourceSummary = z.object({
  id: Cuid,
  slug: z.string().nullable(),
  title: z.string(),
  city: ExportCitySummary.nullable(),
});

export const MeDataExport = z.object({
  exportedAt: IsoDateTime,
  user: MeProfile,
  createdCommunities: z.array(
    z.object({
      community: ExportCommunitySummary,
      createdAt: IsoDateTime,
    }),
  ),
  createdEvents: z.array(
    z.object({
      event: ExportEventSummary,
      createdAt: IsoDateTime,
    }),
  ),
  savedCommunities: z.array(
    z.object({
      community: ExportCommunitySummary,
      savedAt: IsoDateTime,
    }),
  ),
  savedEvents: z.array(
    z.object({
      event: ExportEventSummary,
      savedAt: IsoDateTime,
    }),
  ),
  savedResources: z.array(
    z.object({
      resource: ExportResourceSummary,
      savedAt: IsoDateTime,
    }),
  ),
  contentReports: z.array(
    z.object({
      id: Cuid,
      reportType: z.string(),
      status: z.string(),
      details: z.string().nullable(),
      reporterEmail: z.string().email().nullable(),
      communityId: Cuid.nullable(),
      eventId: Cuid.nullable(),
      suggestedName: z.string().nullable(),
      cityId: Cuid.nullable(),
      createdAt: IsoDateTime,
    }),
  ),
  notificationPreferences: z.array(
    z.object({
      topic: z.string(),
      channel: z.string(),
      enabled: z.boolean(),
    }),
  ),
});
export type MeDataExport = z.infer<typeof MeDataExport>;
