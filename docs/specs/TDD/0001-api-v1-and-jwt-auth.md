# TDD-0001: `/api/v1` + JWT auth

- **Status:** Draft
- **Linked PRD:** PRD-0001
- **Linked ADR:** ADR-0002

## 1. Architecture overview

- New route group: `apps/web/src/app/api/v1/**`. Each handler imports its Zod schema from `packages/shared/src/contracts/<module>`.
- New `apps/web/src/lib/auth/jwt.ts` issues + verifies tokens (RS256, key in env / KMS).
- `apps/web/src/lib/auth/middleware.ts` extracts `Authorization: Bearer …`, attaches `req.user` for handlers.
- Refresh tokens are **opaque, hashed at rest** (SHA-256), one row per device in `RefreshToken`.
- `src/lib/session.ts` cookie-based auth remains for web browser flows — no migration needed. Web (cookies) and mobile (JWT) coexist from day one on the same backend.

## 2. Data model changes

```prisma
model RefreshToken {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique @map("token_hash")
  deviceId    String?  @map("device_id")          // joins to Device (TDD-0002)
  issuedAt    DateTime @default(now()) @map("issued_at")
  expiresAt   DateTime @map("expires_at")
  revokedAt   DateTime? @map("revoked_at")
  rotatedToId String?  @map("rotated_to_id")      // chain for reuse detection
  @@index([userId])
  @@map("refresh_tokens")
}
```

Add `User.appleId String? @unique @map("apple_id")`.

## 3. API surface (subset)

| Method | Path                              | Auth    | Request (Zod)      | Response (Zod) |
| ------ | --------------------------------- | ------- | ------------------ | -------------- |
| POST   | `/api/v1/auth/magic-link/request` | none    | `MagicLinkRequest` | `Ack`          |
| POST   | `/api/v1/auth/magic-link/verify`  | none    | `MagicLinkVerify`  | `AuthTokens`   |
| POST   | `/api/v1/auth/google`             | none    | `OAuthCode`        | `AuthTokens`   |
| POST   | `/api/v1/auth/apple`              | none    | `AppleAuth`        | `AuthTokens`   |
| POST   | `/api/v1/auth/refresh`            | refresh | `RefreshRequest`   | `AuthTokens`   |
| POST   | `/api/v1/auth/logout`             | refresh | `RefreshRequest`   | `Ack`          |
| GET    | `/api/v1/me`                      | access  | —                  | `MeProfile`    |

`AuthTokens = { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, user: MeProfile }`.

## 4. Mobile screens & navigation

None new for this TDD; consumed by PRD-0008.

## 5. Push / Email / Inbox triggers

- Magic-link email reuses `src/lib/email.ts`.

## 6. Feature flags

- `auth.v1.enabled` (default **true**; no staged rollout needed — web is pre-launch with no existing users pinned to old paths).

## 7. Observability

- Counter: `auth.tokens.issued{type=access|refresh, channel=magic|google|apple}`.
- Counter: `auth.refresh.reuse_detected` → alert at >0/min.
- Sentry tag `auth_method`.

## 8. Failure modes & fallbacks

- Reuse of an already-rotated refresh token → revoke entire chain for the user, force re-login, log security event.
- Clock skew → ±60 s tolerance on JWT validation.
- KMS outage → fall back to env key (degrade gracefully, alert).

## 9. Test plan

- Unit: token issue/verify, rotation chain.
- Contract: every endpoint vs. Zod schema fixture.
- E2E: magic-link login on iOS + Android (Detox) + web (Playwright).
- Load: 200 rps on `/auth/refresh` with k6 — P95 < 200 ms.

## 10. Rollout plan

- Ship `/api/v1/auth/*` handlers with `auth.v1.enabled=true` from the first build — no forwarding mode or deprecation window since the web is pre-launch.
- Delete `/api/auth/google` and `/api/auth/google/callback` in the same PR that adds the v1 equivalents.
- Run mobile beta + web Playwright suite against staging before merging.

## 11. Backout plan

- Set `auth.v1.enabled=false`; web browser flows continue uninterrupted via the cookie-based session path (`src/lib/session.ts`). Mobile falls back to magic-link only until re-enabled.
