/**
 * Auth contracts — TDD-0001.
 *
 * NOTE: This file defines the *shapes* the API will use. Handlers
 * are not yet implemented (foundation-only PR per the agreed scope).
 * Each schema below maps 1:1 to a row in TDD-0001 §3 "API surface".
 */

import { z } from 'zod';
import { Ack, Cuid, IsoDateTime } from './common';

// ─── Profile returned by GET /api/v1/me ───

export const UserRole = z.enum(['USER', 'COMMUNITY_ADMIN', 'PLATFORM_ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

export const MeProfile = z.object({
  id: Cuid,
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: UserRole,
  cityId: Cuid.nullable(),
  personaSegments: z.array(z.string()),
  preferredLanguages: z.array(z.string()),
  onboardingComplete: z.boolean(),
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
  /** First-time sign-in only — Apple sends user info once. */
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
