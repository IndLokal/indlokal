# TDD-0011: Magic-link admin & organizer authentication

- **Status:** Shipped
- **Linked PRD:** PRD-0011
- **Linked ADR:** ADR-0004 (email transport)
- **Owner:** Founders

## 1. Architecture overview

```
        ┌─────────────┐  POST /admin/login           ┌──────────────────┐
 user ─▶│ /admin/login│ ───────────────────────────▶ │ requestAdmin     │
        └─────────────┘                              │ MagicLink (action)│
              ▲                                      └────────┬──────────┘
              │                                               │ insertSession (hashed)
              │  email link → GET /admin/verify?token=…       ▼
              │                                       ┌──────────────┐
              │                                       │  Resend      │  (ADR-0004)
              │                                       └──────┬───────┘
              │                                              │
              │   ┌─────────────────────┐  POST  ┌───────────▼──────────┐
              └───│ verify confirm page │──────▶ │ verify route consumes│
                  │ (one button form)   │  303   │ token, sets cookie    │
                  └─────────────────────┘        └──────────────────────┘
```

Critical invariants:

- **Token never travels through GET-side state**. GET only renders a form.
- **Token is hashed at rest**. The cookie carries the raw token; the DB
  carries `sha256(token)`. Comparison is constant-time.
- **Single-use**. The verify POST runs `update … where consumedAt is null`
  in a single statement; subsequent attempts return "already used".

## 2. Data model

`Session` table (Prisma):

| Column       | Type                            | Notes                                        |
| ------------ | ------------------------------- | -------------------------------------------- |
| `id`         | cuid PK                         |                                              |
| `userId`     | FK → User                       |                                              |
| `tokenHash`  | text, unique                    | SHA-256 of raw token                         |
| `purpose`    | enum: `MAGIC_LINK` \| `SESSION` | one row plays both roles across its lifetime |
| `consumedAt` | timestamptz null                | set when magic link is exchanged             |
| `expiresAt`  | timestamptz                     | sliding for SESSION rows                     |
| `createdAt`  | timestamptz                     |                                              |

No new migrations in this work — table existed; column semantics changed
(see §3 TTLs).

## 3. TTLs and cookie

In `apps/web/src/lib/session.ts`:

```ts
export const MAGIC_LINK_TTL_HOURS = 24;
export const SESSION_TTL_DAYS = 7;
export const SESSION_REFRESH_THRESHOLD_HOURS = 24;
```

- `magicLinkExpiry()` → now + 24 h.
- `sessionExpiry()` → now + 7 d.
- `sessionMaxAgeSeconds()` → 7 d in seconds — used for the cookie `Max-Age`.
- Cookie: `il_admin` (HttpOnly, Secure in prod, SameSite=Lax, Path=/).
- Sliding refresh inside `getSessionUser()`: when the row's `expiresAt` is
  within `SESSION_REFRESH_THRESHOLD_HOURS`, run a single `update` that pushes
  it to `now + 7d` and re-emit the cookie. Errors are swallowed — a failed
  refresh must not log the user out mid-request.

## 4. Routes

| Method | Path                                                              | Auth    | Purpose                                                                         |
| ------ | ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| GET    | `/admin/login`                                                    | none    | Form. Renders signed-out banner on `?signed_out=1`.                             |
| POST   | `/admin/login`                                                    | none    | `requestAdminMagicLink` server action. Throws on Resend failure (per ADR-0004). |
| GET    | `/admin/verify?token=…`                                           | none    | Renders one-button confirm page. **Never consumes the token.**                  |
| POST   | `/admin/verify`                                                   | none    | Consumes token, sets cookie, 303 → `/admin`.                                    |
| POST   | `/admin/logout`                                                   | session | Clears cookie + DB row, 303 → `/admin/login?signed_out=1`.                      |
| GET    | `/organizer/login`, `/organizer/verify`, POST `/organizer/logout` | mirror  | Same pattern, `il_organizer` cookie.                                            |

The `seeOther(url)` helper wraps `NextResponse.redirect(url, 303)` because
the default `redirect()` returns **307**, which preserves POST and would
double-submit the verify endpoint on browser back/forward.

## 5. Email triggers

- `auth.admin_magic_link` — From: `IndLokal <noreply@indlokal.com>`,
  link: `${NEXT_PUBLIC_APP_URL}/admin/verify?token=…`, 24 h TTL copy.
- `auth.organizer_magic_link` — same shape, organizer route.

Both transports go through `lib/email.ts` and **propagate** delivery errors
to the action so the user sees a real failure (ADR-0004).

## 6. Environment variables

| Var                   | Scope                         | Notes                                                                                                                                           |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | **Per-environment** in Vercel | Production: `https://indlokal.com`. Preview: per-deploy URL. **Must not be shared** — caused the "magic link already used" production incident. |
| `RESEND_API_KEY`      | Production + Preview          |                                                                                                                                                 |
| `RESEND_FROM_EMAIL`   | Optional override             | Default `IndLokal <noreply@indlokal.com>`.                                                                                                      |
| `ADMIN_EMAIL`         | Bootstrap only                | Seeds the platform admin row.                                                                                                                   |

## 7. Observability

- Server logs on token issue, verify success, verify failure (with reason
  enum: `not_found` / `expired` / `consumed`), session refresh, sign-out.
- Sentry tag `auth.flow = admin|organizer`.
- Alert on Resend non-2xx burst (handled by Resend dashboard for now).

## 8. Failure modes

| Failure                           | Behavior                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Resend down                       | Action throws; form shows "We could not send the email — try again".                 |
| Scanner GET on link               | Renders confirm page; token untouched.                                               |
| Token expired / consumed          | Verify POST returns to login with inline error and "Request a new link" action.      |
| DB unreachable on session refresh | Refresh is best-effort; the current request still resolves with the existing cookie. |
| Cookie tampered                   | `tokenHash` lookup misses; user is treated as signed out.                            |

## 9. Test plan

- Unit: `session.ts` TTL helpers, `consumeToken` single-use semantics,
  sliding-refresh window math.
- Integration: end-to-end magic-link issue → GET (no consume) → POST
  (consume + cookie) → protected page; sign-out clears DB row.
- Manual: Gmail + Outlook scanner pre-fetch does **not** consume the token.

## 10. Rollout

Already shipped to production behind the existing admin route. No flag —
the previous flow had no users besides the founders.

## 11. Backout

- Revert the verify route + session module commits.
- The `Session` table schema is backwards-compatible.
