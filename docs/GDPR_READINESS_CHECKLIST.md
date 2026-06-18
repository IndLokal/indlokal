# GDPR Readiness Checklist (Auth + Account Focus)

- Date: 2026-06-18
- Scope: practical GDPR readiness for current auth/account architecture (web cookie session, mobile JWT, magic-link, app -> web hand-off)
- Note: this is a product/engineering checklist, not legal advice.

## 1) Current implemented baseline

The following controls are already present in product/code:

- Privacy and Terms include auth-provider, session-cookie, and app -> web hand-off language.
- Privacy/Terms/Imprint are reachable in-app on mobile (Me tab) and on web, for both signed-in and anonymous users.
- Web Me page now exposes direct GDPR actions (export + delete-account entry) for signed-in users.
- Account deletion API exists: `DELETE /api/v1/me` (deletes user and revokes active refresh tokens first).
- Mobile has a user-facing delete-account flow wired to that API.
- Self-service privacy requests are auditable: export and account-deletion both write a `privacy_request` row to `ContentLog` (non-blocking).
- Auth tokens are time-bounded:
  - web session cookie TTL with sliding refresh,
  - magic-link one-time TTL,
  - mobile JWT access/refresh TTL,
  - app -> web hand-off one-time short TTL.
- Security posture already avoids long-lived secrets in URLs.

## 2) Minimum required to be GDPR-ready

This is the smallest practical set to complete now.

1. Retention schedule (must publish)

- Use the baseline matrix below as the default policy until legal review finalization.

| Data class                                      | Baseline retention                                           | Trigger / rule                                  | Status             |
| ----------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- | ------------------ |
| Web session cookie/session token                | 7 days sliding session window                                | Expires automatically on inactivity or sign-out | Implemented        |
| Magic-link token                                | 24 hours, single-use                                         | Expires or marks used on verification           | Implemented        |
| Mobile access token                             | 15 minutes                                                   | Auto-expiry                                     | Implemented        |
| Mobile refresh token                            | 30 days                                                      | Rotation/revocation, delete on account deletion | Implemented        |
| App -> web hand-off token                       | 90 seconds, single-use                                       | Expires or marks used on consume                | Implemented        |
| Account profile and role data                   | While account is active                                      | Deleted via account deletion request            | Implemented        |
| Saved items and interaction-linked account data | While account is active                                      | Deleted via account deletion request            | Implemented        |
| User-submitted reports tied to account          | While account is active                                      | Deleted via account deletion request            | Implemented        |
| Notification preferences/devices                | While account is active                                      | Deleted via account deletion request            | Implemented        |
| Operational logs and backup copies              | Define infra-specific windows (hosting + DB backup policies) | Time-based purge by provider policy             | Pending disclosure |

2. DSAR process (must operate)

- Request channel: privacy inbox (`PUBLIC_SITE_EMAILS.privacy`).
- Owner: product owner + engineering owner for execution; legal reviewer where required.
- SLA: acknowledge within 3 business days; complete within 30 days.
- Identity check: verify control of account email before fulfilling export, correction, or deletion requests.
- Minimum execution checklist: access/export, correction, deletion, objection/restriction, confirmation log.
- Audit trail: self-service export/deletion are recorded as `privacy_request` rows in `ContentLog` (`entityType=privacy_request`, `requestType` in metadata); manual DSAR fulfilment should reference these where applicable.

3. Portability path (must support)

- Endpoint implemented: `GET /api/v1/me/export` (authenticated JSON export).
- Web session download route implemented: `GET /me/export` (cookie-authenticated export from web Me page).
- Mobile action implemented: Me tab includes `Export my data (JSON)` and writes a local export file.
- Coverage includes profile, role/claim context, created content, saved items, reports, and notification preferences.
- Each export request is logged as a `privacy_request` audit row for traceability.

4. Processor and transfer transparency (must disclose)

- Use the baseline processor register below and confirm legal transfer basis per provider.

| Function                   | Provider(s) in current stack                              | Personal data category                                | Transfer basis to confirm                   | Status                     |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | -------------------------- |
| Web hosting/runtime        | Vercel                                                    | Account/session/application data processed by web app | DPA + SCC/adequacy as applicable            | Pending legal confirmation |
| Primary database hosting   | Neon (Postgres)                                           | User/profile/content/interaction data at rest         | DPA + SCC/adequacy as applicable            | Pending legal confirmation |
| Transactional email        | Resend                                                    | Account email, auth links, service email metadata     | DPA + SCC/adequacy as applicable            | Pending legal confirmation |
| Auth identity providers    | Google OAuth, Apple Sign in                               | Account identifiers used for sign-in/linking          | Provider terms + SCC/adequacy as applicable | Pending legal confirmation |
| Product analytics          | PostHog (when enabled), Plausible (cookie-free analytics) | Event/usage telemetry (per configuration)             | DPA + SCC/adequacy as applicable            | Pending legal confirmation |
| Object storage for uploads | S3-compatible provider (when enabled)                     | User-submitted media/assets                           | DPA + SCC/adequacy as applicable            | Pending legal confirmation |
| Mobile push delivery       | Expo Push / APNs / FCM (when enabled)                     | Device push tokens and notification metadata          | Provider terms + SCC/adequacy as applicable | Pending legal confirmation |

- Keep this register in sync with actual enabled providers/env configuration.
- If a provider is not enabled in production, mark it as inactive rather than removing it.

5. Breach handling path (must be executable)

- Define incident triage owner and escalation path.
- Maintain a 72-hour breach decision log process and notification templates.

## 3) Keep simple: defer until needed

The following are useful but not blocking for the immediate compliance baseline:

- Full self-serve privacy center UI (if DSAR manual workflow is reliable and SLA-backed).
- Expanded privacy-by-design gates in every spec template.
- Additional compliance automation beyond retention/DSAR/export/incident basics.

## 4) Practical next step (this week)

1. Publish the processor register above as the external subprocessor note (with legal sign-off on transfer basis wording).
2. Run one DSAR dry-run: request -> identity check -> export -> completion log.
3. Confirm provider backup/log retention windows and copy them into this checklist.
4. Update privacy policy with final retention wording from this baseline matrix.

## 5) Legal/ops sign-off tracker (minimal)

- Owner: `<name>`
- Reviewer: `<name>`
- Last reviewed on: `<YYYY-MM-DD>`

| Processor area                | Confirmed? | Notes |
| ----------------------------- | ---------- | ----- |
| Vercel (hosting/runtime)      | [ ]        |       |
| Neon (database)               | [ ]        |       |
| Resend (transactional email)  | [ ]        |       |
| Google / Apple auth providers | [ ]        |       |
| PostHog / Plausible analytics | [ ]        |       |
| S3-compatible media storage   | [ ]        |       |
| Expo Push / APNs / FCM        | [ ]        |       |

## 6) Evidence links in this repo

- Auth architecture: [AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md](./AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md)
- Integration architecture: [MOBILE_WEB_INTEGRATION.md](./MOBILE_WEB_INTEGRATION.md)
- Mobile strategy: [MOBILE_APP_STRATEGY.md](./MOBILE_APP_STRATEGY.md)
- Privacy page: [apps/web/src/app/(info)/privacy/page.tsx](<../apps/web/src/app/(info)/privacy/page.tsx>)
- Terms page: [apps/web/src/app/(info)/terms/page.tsx](<../apps/web/src/app/(info)/terms/page.tsx>)
- Account deletion API (with privacy audit row): [apps/web/src/app/api/v1/me/route.ts](../apps/web/src/app/api/v1/me/route.ts)
- Account data export API (with privacy audit row): [apps/web/src/app/api/v1/me/export/route.ts](../apps/web/src/app/api/v1/me/export/route.ts)
- Web account export route: [apps/web/src/app/me/export/route.ts](../apps/web/src/app/me/export/route.ts)
- Web Me page GDPR controls: [apps/web/src/app/me/page.tsx](../apps/web/src/app/me/page.tsx)
- Web delete-account screen: [apps/web/src/app/me/delete-account/page.tsx](../apps/web/src/app/me/delete-account/page.tsx)
- Mobile delete-account screen: [apps/mobile/app/me/delete-account.tsx](../apps/mobile/app/me/delete-account.tsx)
- Mobile data-export + legal links: [apps/mobile/app/(tabs)/me.tsx](<../apps/mobile/app/(tabs)/me.tsx>)
