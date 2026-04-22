# TDD-NNNN: <Feature title>

- **Status:** Draft | Approved | Shipped
- **Linked PRD:** PRD-NNNN
- **Owner:** <name>

## 1. Architecture overview

Diagram or short prose. Components touched.

## 2. Data model changes

Prisma diff / migration outline. Indexes.

## 3. API surface

Zod schemas (in `packages/shared/src/...`) + endpoint table; link to generated OpenAPI.

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |

## 4. Mobile screens & navigation

Expo Router paths, navigation graph, deep links.

## 5. Push / Email / Inbox triggers

Reference rows in `EVENTS/notifications.md`.

## 6. Feature flags

Names + default values + kill-switch behavior.

## 7. Observability

Logs, metrics, traces, Sentry tags, alerts.

## 8. Failure modes & fallbacks

Network, auth expiry, partial outage, push delivery failure.

## 9. Test plan

- Unit:
- Contract (Pact / OpenAPI schema):
- E2E (Detox iOS+Android, Playwright web):
- Load (k6) if new endpoint:

## 10. Rollout plan

Flag → 1 % → 10 % → 50 % → 100 %.

## 11. Backout plan

How to disable safely.
