# ADR-0004: Email transport — Resend in production with throw-on-failure

- **Date:** 2026-05-09
- **Status:** Accepted

## Context

Email is on the critical path for two flows that block users entirely if
they fail silently:

1. **Admin / organizer login** — magic links are the only way in.
2. **Submission and claim notifications** — reviewers and submitters expect
   acknowledgement.

The first cut logged Resend API errors and returned `{ ok: false }` to the
caller, which the magic-link request action then ignored — so users saw
"Check your inbox" while no email had been sent. This was the single biggest
source of "I can't log in" support load before the Resend domain was even
verified, because the failure was completely invisible.

We also need a sane default for local dev that doesn't require any account
setup, and a deterministic env-variable contract.

## Decision

Three transports, selected by env at module load:

| Env                             | Transport                         | Notes                          |
| ------------------------------- | --------------------------------- | ------------------------------ |
| `RESEND_API_KEY` set            | Resend HTTP API                   | Used in prod and preview       |
| `SMTP_HOST` set (no Resend key) | Nodemailer → Mailpit / local SMTP | Local dev default              |
| Neither                         | Console transport                 | CI; logs payload, never throws |

**Rules:**

- The Resend transport **throws** `Error("Resend delivery failed: …")` on a
  non-2xx response. Best-effort callers (e.g. claim approval emails) catch
  and swallow; auth-critical callers (`requestAdminMagicLink`,
  `requestOrganizerMagicLink`) propagate the error to the form so the user
  sees a real failure instead of a silent success page.
- Default FROM is `IndLokal <noreply@indlokal.com>`. Override with
  `RESEND_FROM_EMAIL`.
- The verified Resend sending domain is `mail.indlokal.com` (Ireland region);
  the apex `indlokal.com` is reserved for the public site.
- All product links in emails use `NEXT_PUBLIC_APP_URL` (default
  `https://indlokal.com`). This env var must be scoped per Vercel
  environment if preview deploys are ever expected to email links to the
  preview URL — see TDD-0011 §8.

## Consequences

- **Positive:** silent failures are impossible on the auth path; a missing
  Resend key in prod fails loudly at first send; local dev needs no setup.
- **Negative:** any Resend incident now surfaces directly to the admin login
  page; we accept this in exchange for never showing a fake success screen.
- **Neutral:** dev iteration uses Mailpit, so devs preview real HTML.

## Alternatives considered

- **Postmark / SES** — both fine; Resend chosen for the fastest setup, EU
  region availability, and DKIM/SPF UI. Decision is reversible — the
  transport is one file (`apps/web/src/lib/email.ts`).
- **Queue all email through the notification outbox first** — better for
  retries and batching, but adds latency to magic links and blocks shipping
  Phase-1 admin auth. Will revisit when worker channel adapters land
  (PRD/TDD-0002).
- **Catch and log all errors uniformly** — rejected; that's exactly the bug
  we are fixing.
