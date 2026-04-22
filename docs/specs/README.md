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

| ID                      | Title                                                  | Status   |
| ----------------------- | ------------------------------------------------------ | -------- |
| ADR-0001                | Adopt Expo + monorepo; reject PWA                      | Accepted |
| ADR-0002                | Zod-as-contract; OpenAPI generated                     | Accepted |
| PRD/TDD-0001            | `/api/v1` cutover + JWT/refresh auth                   | Draft    |
| PRD/TDD-0002            | Device registry + NotificationPreference + Outbox      | Draft    |
| PRD/TDD-0003            | Mobile Discover feed (city + events + communities)     | Draft    |
| PRD/TDD-0004            | Push permission flow + topic preferences UI            | Draft    |
| PRD/TDD-0005            | Event detail: save, RSVP/registration, calendar, share | Draft    |
| PRD/TDD-0006            | Community detail: follow, access channels, related     | Draft    |
| PRD/TDD-0007            | Search + filters (city, category, date)                | Draft    |
| PRD/TDD-0008            | Mobile auth: Apple, Google, magic link                 | Draft    |
| PRD/TDD-0009            | Submit event/community (camera + gallery)              | Draft    |
| PRD/TDD-0010            | Resources, Bookmarks, Report content                   | Draft    |
| EVENTS/analytics.md     | Analytics event catalog                                | Draft    |
| EVENTS/notifications.md | Notification matrix                                    | Draft    |

The spec set above defines the **mobile MVP at functional parity with the current web**, plus the foundations (auth, devices, outbox, OpenAPI) needed to support it.
