# TDD-0058: Cross-surface auth hand-off (app → web)

- **Status:** Approved
- **Linked PRD:** PRD-0058
- **Owner:** Auth/Platform

## 1. Architecture overview

```
Mobile (JWT in SecureStore)                Web (cookie session)
───────────────────────────                ──────────────────────────
useWebHandoff()                            GET /auth/handoff?token&next
  └─ openWebHandoff (expo)                   ├─ consumeWebHandoffToken()
       └─ requestWebHandoffUrl (pure) ──►    │    (single-use, fresh)
          POST /api/v1/auth/handoff          ├─ createSession() → lp_session
            ├─ requireAccessToken (JWT)      └─ redirect → safe `next` (/me)
            ├─ mintWebHandoffToken()
            └─ { url, expiresAt }
       └─ WebBrowser.openBrowserAsync(url)
```

The hand-off reuses **existing** building blocks: the mobile `AuthClient`
(`postAuthed`), `requireAccessToken` (JWT middleware), and `createSession`
(the same `lp_session` HttpOnly cookie normal web login uses). It adds one tiny
single-use token table and two thin route handlers. The mobile JWT contract is
unchanged.

This TDD is intentionally narrow: it does **not** introduce a UI redesign, a
role-aware workspace hub, or a broad RBAC refactor. Those are separate follow-up
efforts; this work only makes the authenticated bridge reusable.

## 2. Data model changes

New table mirroring `MagicLinkToken` (hash at rest, single-use via `usedAt`):

```prisma
model WebHandoffToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique @map("token_hash") // SHA-256 of the raw token
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  next      String?   // validated relative path to land on after consume
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")            // set when consumed - prevents replay
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("web_handoff_tokens")
}
```

`User` gains `webHandoffTokens WebHandoffToken[]`. Migration
`20260618120000_web_handoff_token`. TTL = 90 seconds.

## 3. API surface

Zod in `packages/shared/src/contracts/auth.ts`:

```ts
WebHandoffRequest  = { next?: string (≤500) }
WebHandoffResponse = { url: string(url), expiresAt: IsoDateTime }
```

| Method | Path                   | Auth         | Request             | Response             |
| ------ | ---------------------- | ------------ | ------------------- | -------------------- |
| POST   | `/api/v1/auth/handoff` | Bearer JWT   | `WebHandoffRequest` | `WebHandoffResponse` |
| GET    | `/auth/handoff`        | one-time tkn | `?token&next`       | 302 redirect         |

Flag OFF → both return 404. Mint without a valid access token → 401.

## 4. Mobile screens & navigation

- Pure `apps/mobile/lib/auth/web-handoff.ts`: `requestWebHandoffUrl(client, { next? })`
  (validates response via `auth.WebHandoffResponse`, returns https url), plus
  `isHttpsUrl` guard. No Expo imports → node-testable.
- Expo `apps/mobile/lib/auth/web-handoff.expo.ts`: `openWebHandoff(client, { next? })`
  → requests url → `WebBrowser.openBrowserAsync(url)`; `useWebHandoff()` hook
  returns `{ open, isOpening }`. Errors mapped via `describeAuthError(e, 'session')`.
- Current app trigger: the Me tab exposes a minimal `Open web version` button
  that calls the hook when the bridge flag is enabled. The role-aware workspace
  hub remains separate and can reuse the same hook later.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

`AUTH_WEB_HANDOFF_ENABLED` (default OFF). When OFF, the mint endpoint and the
consume route both behave as if the feature does not exist (404). Kill-switch:
set to anything other than `true`.

## 7. Observability

- Analytics: successful consume reuses the existing canonical `USER_LOGGED_IN`
  event with `{ login_surface:'web', auth_method:'handoff' }` (no new catalog
  names added, keeping `EVENTS/analytics.md` strict/alias-free).
- Server logs on consume failure log only a classified `reason`
  (`missing|invalid|flag_off`) — never the raw token or user data. The mint
  endpoint never logs the token.

## 8. Failure modes & fallbacks

- Network/auth expiry on mint → mobile shows friendly message; the mobile client
  already refreshes the JWT once on 401.
- Invalid / expired / already-used token on consume → redirect
  `/me/login?error=handoff` (no session).
- Unsafe `next` → session still set, redirect to `/me`.
- Single-use enforced by an atomic `updateMany({ where: { id, usedAt: null }})`
  guard so concurrent opens cannot both succeed.

## 9. Test plan

- **Unit:** `safeNextPath` (relative-only, rejects absolute/`//`/`\\`); mobile
  `requestWebHandoffUrl` (posts next, parses url, rejects non-https).
- **Contract:** `WebHandoffRequest`/`WebHandoffResponse` parse.
- **Integration (web, test DB):** mint requires auth + flag (401 / 404 / 200);
  consume sets cookie + redirects on fresh token; rejects reused + expired;
  unsafe `next` falls back to `/me`.
- **E2E (manual):** mobile open → in-app browser lands authenticated.

## 10. Rollout plan

Flag default OFF. Enable in staging after migration applied → manual
cross-surface QA → 1% → 10% → 50% → 100%.

## 11. Backout plan

Set `AUTH_WEB_HANDOFF_ENABLED` to unset/false. Endpoints 404; the table is
additive and inert. No data migration to reverse.
