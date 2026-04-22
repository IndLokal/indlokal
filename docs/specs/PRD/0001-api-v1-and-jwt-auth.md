# PRD-0001: `/api/v1` cutover with JWT + refresh-token auth

- **Status:** Draft
- **Owner:** Backend lead
- **Reviewers:** PM, Eng Lead, Mobile lead
- **Linked:** TDD-0001, ADR-0002

## 1. Problem

Mobile clients cannot rely on cookie-based sessions and need a stable, versioned API surface. Today web uses opaque `sessionToken` in cookies (`src/lib/session.ts`). We need:

- A versioned base path that mobile can pin against.
- Token-based auth that survives app cold-starts and works with secure native storage.

## 2. Users & JTBD

- Mobile engineers — "I want a single, typed, versioned API to call from React Native."
- Backend engineers — "I want one auth model for web + mobile + future integrations."

## 3. Success Metrics

- 100 % of new mobile traffic on `/api/v1/*`.
- P95 token refresh latency < 200 ms.
- Zero auth-related crashes per 10k sessions (Sentry).

## 4. Scope

- Build `/api/v1/*` route group from scratch. Migrate the dev-stage `/api/auth/google` and `/api/auth/google/callback` routes directly to their v1 equivalents and delete the old paths in the same release.
- Issue **access JWT (15 min)** + **refresh token (60 d, rotated)**.
- Endpoints: `POST /auth/magic-link/request`, `POST /auth/magic-link/verify`, `POST /auth/google`, `POST /auth/apple`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`.
- Web uses cookie-based sessions (`src/lib/session.ts`) for browser flows — unchanged. Mobile uses JWT exclusively. Both are served by the same backend from day one; there is no staged cutover.
- OpenAPI emitted to `packages/shared/openapi.yaml`.

## 5. Out of Scope

- Legacy `/api/*` forwarding mode: **not applicable** — web is in active development, not live. The existing `/api/auth/google` routes will be migrated to `/api/v1/auth/google` and the old paths deleted in the same release. No deprecation window needed.
- Email/SMS 2FA. Apple + Google + magic link covers the launch audience; 2FA adds friction that will suppress new-user conversion.

## 6. User Stories

- As a mobile user I can sign in with magic link / Google / Apple and stay signed in across cold starts.
- As a mobile user my session refreshes silently in the background.
- As a backend dev I can add a new endpoint by writing a Zod schema and a handler — OpenAPI updates in CI.

## 7. Acceptance Criteria

```
Given a mobile client with a valid refresh token
When the access token expires mid-request
Then the client transparently refreshes and retries once, with no user-visible error

Given a user signs out
When /auth/logout is called
Then the refresh token is revoked and reuse returns 401 with code TOKEN_REUSED
```

## 8. UX

None user-visible beyond auth screens (covered by PRD-0008).

## 9. Risks & Open Questions

- Refresh-token rotation race conditions on parallel requests → mitigated by single-flight refresh in client.
- Web ↔ mobile session unification — phase 2.
