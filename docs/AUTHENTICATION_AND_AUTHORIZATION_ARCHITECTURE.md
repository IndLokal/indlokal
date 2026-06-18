# Authentication and Authorization Architecture (As Built)

Status: Active source of truth for implementation behavior  
Last reviewed: 2026-06-18

## 1. Purpose

This document describes the current, implemented authentication and authorization model across web and mobile.

Use this doc when you need code-aligned truth for:

- how users sign in on each surface,
- how sessions/tokens are stored and refreshed,
- how app -> web auth hand-off works,
- how RBAC and scoped authority are enforced,
- what clients should use for UI gating.

## 2. Document Hierarchy

- Product role model (target semantics): [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md)
- Flow-to-authority mapping (target flows): [RBAC_FLOW_MAPPING.md](./RBAC_FLOW_MAPPING.md)
- This document: as-built architecture and operational behavior.

If there is a mismatch between docs, this file is the runtime behavior reference and should be updated first, then linked docs reconciled.

## 3. Authentication Surfaces

### 3.1 Web member login

- Entry: `/me/login`
- Primary provider: Google OAuth start/callback flow
- Session model: secure cookie session (`lp_session`) on the web origin
- Relevant code:
  - [apps/web/src/app/me/login/page.tsx](../apps/web/src/app/me/login/page.tsx)
  - [apps/web/src/lib/session.ts](../apps/web/src/lib/session.ts)

### 3.2 Web organizer and admin login

- Entries: `/organizer/login`, `/admin/login`
- Mechanism: magic-link email flow (passwordless)
- Session model: same web cookie session (`lp_session`)
- Success UX includes explicit role-specific return links to avoid browser-history surprises.
- Relevant code:
  - [apps/web/src/app/organizer/login/page.tsx](../apps/web/src/app/organizer/login/page.tsx)
  - [apps/web/src/app/admin/login/page.tsx](../apps/web/src/app/admin/login/page.tsx)
  - [apps/web/src/components/auth/login-success.tsx](../apps/web/src/components/auth/login-success.tsx)

### 3.3 Mobile sign-in

- Entry: mobile auth sign-in screen
- Mechanisms: Google, Apple, and magic-link API flows
- Session model: JWT access + refresh tokens in secure storage
- Auth feedback: inline banners in the screen flow (not modal popups for auth failures)
- Relevant code:
  - [apps/mobile/app/auth/sign-in.tsx](../apps/mobile/app/auth/sign-in.tsx)
  - [apps/mobile/lib/auth/token-store.ts](../apps/mobile/lib/auth/token-store.ts)
  - [packages/shared/src/contracts/auth.ts](../packages/shared/src/contracts/auth.ts)

## 4. Session and Token Model

### 4.1 Web

- Cookie name: `lp_session`
- Session TTL: 7 days with sliding extension on activity
- Token storage: raw token in cookie, hashed token in storage
- Magic-link token policy: one-time, hashed at rest, 24h TTL
- Relevant code:
  - [apps/web/src/lib/session.ts](../apps/web/src/lib/session.ts)

### 4.2 Mobile

- Access/refresh JWT pair follows shared auth contract
- Stored in secure storage through the token store abstraction
- `/api/v1/me` is used to refresh richer role/scope context for UI gating
- Relevant code:
  - [apps/mobile/lib/auth/token-store.ts](../apps/mobile/lib/auth/token-store.ts)
  - [apps/web/src/app/api/v1/me/route.ts](../apps/web/src/app/api/v1/me/route.ts)

## 5. Cross-Surface Auth Hand-Off (App -> Web)

### 5.1 What is implemented

- Mobile can mint a one-time hand-off URL via `POST /api/v1/auth/handoff`
- Mobile opens that URL in in-app browser
- Web consumes token at `GET /auth/handoff`, creates normal web cookie session, and redirects to safe `next`
- Invalid/expired/reused tokens redirect to `/me/login?error=handoff`

### 5.2 Security properties

- Feature flag gated: disabled means both routes are inert/404
- Hand-off token is one-time, short-lived, hashed at rest
- Only validated relative `next` paths are accepted
- No long-lived browser secret is ever placed in URL

### 5.3 Relevant code

- [apps/web/src/lib/config/flags.ts](../apps/web/src/lib/config/flags.ts)
- [apps/web/src/app/api/v1/auth/handoff/route.ts](../apps/web/src/app/api/v1/auth/handoff/route.ts)
- [apps/web/src/app/auth/handoff/route.ts](../apps/web/src/app/auth/handoff/route.ts)
- [apps/mobile/lib/auth/web-handoff.ts](../apps/mobile/lib/auth/web-handoff.ts)
- [apps/mobile/lib/auth/web-handoff.expo.ts](../apps/mobile/lib/auth/web-handoff.expo.ts)
- [apps/mobile/app/(tabs)/me.tsx](<../apps/mobile/app/(tabs)/me.tsx>)

## 6. Authorization and RBAC Model

### 6.1 Platform-level authority

- Primary role enum exists on user profile for coarse identity
- Scoped authority is represented via `RoleAssignment` (city/org scopes, revocation)
- Server-side permission checks are mandatory; UI gating is only convenience

### 6.2 Community-level authority

- Community governance authority is community-scoped and represented in collaborator membership
- Claimed-community context is also surfaced in profile for cross-surface workspace gating

### 6.3 Client-facing profile shape for gating

`GET /api/v1/me` returns a profile containing:

- base user role,
- roleAssignments,
- claimedCommunities,
- onboarding and profile fields.

This is the canonical payload for mobile and web UI role-aware surface decisions.

Relevant code:

- [apps/web/src/lib/auth/profile.ts](../apps/web/src/lib/auth/profile.ts)
- [apps/web/src/app/api/v1/me/route.ts](../apps/web/src/app/api/v1/me/route.ts)
- [packages/shared/src/contracts/auth.ts](../packages/shared/src/contracts/auth.ts)
- [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)

## 7. UX Alignment Notes (Current)

- Web has role-specific login routes (`/me/login`, `/organizer/login`, `/admin/login`) with aligned shell and alerts.
- Organizer/admin success states now provide explicit route-specific back links.
- Mobile currently uses one unified sign-in page (not separate role login pages).
- Mobile role-specific destinations are exposed from the Me workspace section and open native routes or authenticated web hand-off destinations based on availability.

## 8. Explicit Non-Goals

- No broad RBAC redesign in this auth alignment track.
- No promise of full native parity for all admin/organizer desktop workflows in mobile.
- No replacement of server authorization with client-only role checks.

## 9. Update Checklist

When auth/authz behavior changes, update this file and verify links/claims for:

1. entry route(s),
2. session/token storage model,
3. contracts (`packages/shared`),
4. hand-off behavior and flags,
5. role/scope gating source (`/api/v1/me`),
6. related blueprint/audit docs.
