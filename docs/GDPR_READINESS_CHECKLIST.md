# GDPR Readiness Checklist (Auth + Account Focus)

- Date: 2026-06-18
- Scope: practical GDPR readiness for current auth/account architecture (web cookie session, mobile JWT, magic-link, app -> web hand-off)
- Note: this is a product/engineering checklist, not legal advice.

## 1) Current implemented baseline

The following controls are already present in product/code:

- Privacy and Terms include auth-provider, session-cookie, and app -> web hand-off language.
- Account deletion API exists: `DELETE /api/v1/me` (deletes user and revokes active refresh tokens first).
- Mobile has a user-facing delete-account flow wired to that API.
- Auth tokens are time-bounded:
  - web session cookie TTL with sliding refresh,
  - magic-link one-time TTL,
  - mobile JWT access/refresh TTL,
  - app -> web hand-off one-time short TTL.
- Security posture already avoids long-lived secrets in URLs.

## 2) Minimum required to be GDPR-ready

This is the smallest practical set to complete now.

1. Retention schedule (must publish)

- Define retention windows per data class: auth/session data, account/profile data, submissions, analytics, logs, backups.
- Define deletion or anonymization trigger for each class.
- Reflect this in privacy policy and an internal runbook.

2. DSAR process (must operate)

- One request channel and identity-verification steps.
- Owner + SLA (default target: <= 30 days).
- Execution checklist for access, correction, deletion, objection/restriction.

3. Portability path (must support)

- Either ship user data export (JSON/CSV), or document a manual export runbook with SLA.
- Cover at least: profile, role assignments, saved items, and user submissions linked to account.

4. Processor and transfer transparency (must disclose)

- Maintain a subprocessor list (hosting, email, analytics, auth providers, storage).
- Document transfer basis where relevant (for example SCC/adequacy).

5. Breach handling path (must be executable)

- Define incident triage owner and escalation path.
- Maintain a 72-hour breach decision log process and notification templates.

## 3) Keep simple: defer until needed

The following are useful but not blocking for the immediate compliance baseline:

- Full self-serve privacy center UI (if DSAR manual workflow is reliable and SLA-backed).
- Expanded privacy-by-design gates in every spec template.
- Additional compliance automation beyond retention/DSAR/export/incident basics.

## 4) Practical next step (this week)

1. Finalize retention matrix and publish policy text.
2. Publish DSAR runbook with owner and SLA.
3. Publish subprocessor list and transfer basis note.
4. Add portability runbook (or endpoint) and test one dry-run request.

## 5) Evidence links in this repo

- Auth architecture: [AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md](./AUTHENTICATION_AND_AUTHORIZATION_ARCHITECTURE.md)
- Integration architecture: [MOBILE_WEB_INTEGRATION.md](./MOBILE_WEB_INTEGRATION.md)
- Mobile strategy: [MOBILE_APP_STRATEGY.md](./MOBILE_APP_STRATEGY.md)
- Privacy page: [apps/web/src/app/(info)/privacy/page.tsx](<../apps/web/src/app/(info)/privacy/page.tsx>)
- Terms page: [apps/web/src/app/(info)/terms/page.tsx](<../apps/web/src/app/(info)/terms/page.tsx>)
- Account deletion API: [apps/web/src/app/api/v1/me/route.ts](../apps/web/src/app/api/v1/me/route.ts)
- Mobile delete-account screen: [apps/mobile/app/me/delete-account.tsx](../apps/mobile/app/me/delete-account.tsx)
