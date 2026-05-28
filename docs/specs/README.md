# IndLokal Specs

Spec-driven workflow per [`docs/MOBILE_APP_STRATEGY.md`](../MOBILE_APP_STRATEGY.md) §3.

## Layout

```
docs/specs/
  README.md           # this file
  templates/          # PRD / TDD / ADR templates
  ADR/                # Architecture Decision Records (immutable, numbered)
  PRD/                # Product Requirement Docs
  TDD/                # Technical Design Docs
  API/                # API contract notes (Zod-source-of-truth, OpenAPI generated)
  EVENTS/             # Analytics + Notification event catalogs
  UX/                 # Figma links + flow notes (not in repo binary form)
```

## Numbering

- `ADR-NNNN` - sequential, never reused, never deleted (mark Superseded).
- `PRD-NNNN` / `TDD-NNNN` - paired by number when 1:1; multi-PRD per TDD allowed.

## Workflow per feature

1. Open PRD draft → review with PM + Eng Lead + Design.
2. Open UX draft (Figma link in `UX/`).
3. Define API in `packages/shared` Zod schemas; export OpenAPI; capture in `API/`.
4. Write TDD covering data, modules, push/email, flags, observability, rollout, backout.
5. (Optional) ADR if a non-obvious architectural call is made.
6. Implement behind a feature flag, referencing the spec in every PR.
7. Verify acceptance criteria + Sentry + analytics in staging.
8. Stage roll out 1 % → 10 % → 50 % → 100 %.
9. Post-launch review at 2 weeks vs. PRD targets.

## Status of the first spec set (Phase 0 → Phase 1 MVP)

Spec status (`Draft` / `Accepted` / `Superseded`) describes the spec document
itself, not the build. Implementation progress is tracked in the right-most
column and is the single source of truth for what is shipped.

| ID                      | Title                                                                       | Spec        | Implementation                                                          |
| ----------------------- | --------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| ADR-0001                | Adopt Expo + monorepo; reject PWA                                           | Accepted    | Done                                                                    |
| ADR-0002                | Zod-as-contract; OpenAPI generated                                          | Accepted    | Done                                                                    |
| ADR-0003                | Three-tier database seeding (bootstrap/directory/demo)                      | Accepted    | Done                                                                    |
| ADR-0004                | Email transport: Resend with throw-on-failure                               | Accepted    | Done                                                                    |
| ADR-0005                | Role + scoped permission model (city / org)                                 | Proposed    | Not started                                                             |
| PRD/TDD-0001            | `/api/v1` cutover + JWT/refresh auth                                        | Draft       | Done - all `/api/v1/*` routes shipped                                   |
| PRD/TDD-0002            | Device registry + NotificationPreference + Outbox                           | Draft       | Server: Done. Worker channel adapters partial                           |
| PRD/TDD-0003            | Mobile Discover feed (city + events + communities)                          | Draft       | Done - Events / Communities / For-you tabs + trending rail              |
| PRD/TDD-0004            | Push permission flow + topic preferences UI                                 | Draft       | Pre-prompt + preferences screen shipped                                 |
| PRD/TDD-0005            | Event detail: save, RSVP/registration, calendar, share                      | Draft       | Done - hero image, venue map card, 1h local reminders                   |
| PRD/TDD-0006            | Community detail: follow, access channels, related                          | Draft       | Done - Pulse-Score panel + related communities rail                     |
| PRD/TDD-0007            | Search + filters (city, category, date)                                     | Draft       | Done - full results screen with type + date filters                     |
| PRD/TDD-0008            | Mobile auth: Apple, Google, magic link                                      | Draft       | Done - incl. Universal-Link magic-link verify                           |
| PRD/TDD-0009            | Submit event/community (camera + gallery)                                   | Draft       | Done (text-only v1) - image picker pending                              |
| PRD/TDD-0010            | Resources, Bookmarks, Report content                                        | Draft       | Done - Resources, Bookmarks, Report sheet shipped                       |
| PRD/TDD-0011            | Magic-link admin & organizer auth (sign-out, sliding session)               | Draft       | Done - 24h links, 7d sliding session, scanner-safe verify               |
| PRD/TDD-0012            | Admin data management console (CRUD + safe delete)                          | Draft       | Done - `/admin/data` + delete actions for city/community/event/resource |
| PRD-0014                | Expanded roles, scoped assignments, and admin RBAC                          | Draft       | Not started                                                             |
| PRD-0015                | City Ambassador console                                                     | Draft       | Not started                                                             |
| PRD-0016                | Outreach CRM module                                                         | Draft       | Not started                                                             |
| PRD-0017                | Multi-community ownership + event-only host flow                            | Draft       | Not started                                                             |
| PRD-0018                | Audit log viewer                                                            | Draft       | Not started                                                             |
| PRD/TDD-0020            | Business events lens and business discovery scope                           | Draft       | Not started (spec-first)                                                |
| PRD/TDD-0021            | Content clarity for community actions                                       | Draft       | Done - shared content registry wired across key web/mobile flows        |
| PRD/TDD-0022            | Embedded community calendar ingestion (known-but-unclaimed sources)         | Draft       | Not started (spec-first)                                                |
| PRD/TDD-0023            | City onboarding baseline and metro-aware submission intake                  | Draft       | In progress (spec-first alignment)                                      |
| PRD/TDD-0024            | Scoped pipeline source strategy and run observability                       | Draft       | In progress (spec-first alignment)                                      |
| PRD/TDD-0025            | GitHub Actions cron sharding and telemetry                                  | Draft       | In progress (spec-first alignment)                                      |
| PRD/TDD-0026            | Pipeline reliability hardening (fail-closed filter, retry budget, lock)     | Approved    | Done - shipped with migration `20260526160000` + cron advisory lock     |
| PRD/TDD-0027            | Per-LLM-call audit & cost telemetry (`PipelineLlmCall`)                     | Approved    | Done - shipped with migration `20260526170000`                          |
| PRD/TDD-0028            | Pipeline cost guardrails (per-run token budget + circuit breaker)           | Approved    | Done - shipped with migration `20260526180000`                          |
| ADR-0006                | Pipeline is ETL, not Agent (terminology lock-in)                            | Accepted    | Done - `AI_AGENT_*.md` renamed to `AI_PIPELINE_*.md` on 2026-05-26      |
| ADR-0007                | Resource scope and resolution model                                         | Accepted    | In progress (this branch)                                               |
| PRD/TDD-0030            | Resources v2 - scope, satellite parity, first-30-days journey               | Approved    | In progress (`feat/resources-v2-spec-driven`)                           |
| PRD/TDD-0031            | Submission ownership and claim lifecycle alignment                          | Draft       | In progress (spec-first; interim auto-claim shipped)                    |
| PRD/TDD-0032            | Flexible community channels and claim evidence capture                      | Draft       | In progress - web phases 1-4 shipped; mobile parity deferred            |
| PRD/TDD-0033            | Submission and claim PII notice baseline                                    | Draft       | In progress - notice + metadata receipt shipped for submit/claim        |
| PRD/TDD-0034            | Organizer collaborator access for claimed communities (minimal v1)          | Draft       | Not started                                                             |
| PRD-0019 / TDD-0019     | Auth completion - onboarding, session restore, profile & account management | Implemented | Implemented                                                             |
| PRD/TDD-0019            | Admin Auth v2 minimal hardening (gate-first, no new auth)                   | Draft       | In progress (spec-first)                                                |
| PRD/TDD-0013            | Pipeline review & submissions queue scoping                                 | Draft       | Done - queue scoped to user submissions; admin-approved → ACTIVE        |
| EVENTS/analytics.md     | Analytics event catalog                                                     | Draft       | -                                                                       |
| EVENTS/notifications.md | Notification matrix                                                         | Draft       | -                                                                       |

The spec set above defines the **mobile MVP at functional parity with the current web**, plus the foundations (auth, devices, outbox, OpenAPI) needed to support it.
