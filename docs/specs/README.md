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

- `ADR-NNNN` — sequential, never reused, never deleted (mark Superseded).
- `PRD-NNNN` / `TDD-NNNN` — paired by number when 1:1; multi-PRD per TDD allowed.

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

| ID                      | Title                                                  | Spec     | Implementation                                              |
| ----------------------- | ------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| ADR-0001                | Adopt Expo + monorepo; reject PWA                      | Accepted | Done                                                        |
| ADR-0002                | Zod-as-contract; OpenAPI generated                     | Accepted | Done                                                        |
| PRD/TDD-0001            | `/api/v1` cutover + JWT/refresh auth                   | Draft    | Done — all `/api/v1/*` routes shipped                       |
| PRD/TDD-0002            | Device registry + NotificationPreference + Outbox      | Draft    | Server: Done. Worker channel adapters partial               |
| PRD/TDD-0003            | Mobile Discover feed (city + events + communities)     | Draft    | v1 shipped (no sub-tabs, no trending rail yet)              |
| PRD/TDD-0004            | Push permission flow + topic preferences UI            | Draft    | Pre-prompt + preferences screen shipped                     |
| PRD/TDD-0005            | Event detail: save, RSVP/registration, calendar, share | Draft    | v1 shipped (no hero image, no map, no in-app reminders yet) |
| PRD/TDD-0006            | Community detail: follow, access channels, related     | Draft    | v1 shipped (no related rail, no Pulse-Score drill-in yet)   |
| PRD/TDD-0007            | Search + filters (city, category, date)                | Draft    | Done — full results screen with type + date filters         |
| PRD/TDD-0008            | Mobile auth: Apple, Google, magic link                 | Draft    | Done — incl. Universal-Link magic-link verify               |
| PRD/TDD-0009            | Submit event/community (camera + gallery)              | Draft    | Done (text-only v1) — image picker pending                  |
| PRD/TDD-0010            | Resources, Bookmarks, Report content                   | Draft    | Done — Resources, Bookmarks, Report sheet shipped           |
| EVENTS/analytics.md     | Analytics event catalog                                | Draft    | —                                                           |
| EVENTS/notifications.md | Notification matrix                                    | Draft    | —                                                           |

The spec set above defines the **mobile MVP at functional parity with the current web**, plus the foundations (auth, devices, outbox, OpenAPI) needed to support it.
