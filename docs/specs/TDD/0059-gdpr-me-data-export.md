# TDD-0059: GDPR Me Data Export (`GET /api/v1/me/export`)

- **Status:** Approved
- **Linked PRD:** PRD-0059
- **Owner:** Auth/Platform

## 1. Architecture overview

Add a new authenticated API route under `/api/v1/me/export` that aggregates user-linked data from existing tables and returns a schema-validated JSON payload using `auth.MeDataExport` from `@indlokal/shared`.

## 2. Data model changes

No migration required. Uses existing models:

- `User`, `RoleAssignment`, `Community` (claims + created)
- `Event` (created)
- `SavedCommunity`, `SavedEvent`, `SavedResource`
- `ContentReport`
- `NotificationPreference`

## 3. API surface

| Method | Path                | Auth   | Request | Response            |
| ------ | ------------------- | ------ | ------- | ------------------- |
| GET    | `/api/v1/me/export` | Bearer | -       | `auth.MeDataExport` |

Implementation notes:

- Reuse existing `requireAccessToken` middleware.
- Reuse `toMeProfile` mapper to avoid profile drift/leaks.
- Parse response through `auth.MeDataExport.parse(...)` before returning.
- Exclude token/session secret fields by design (never selected in queries).

## 4. Mobile screens & navigation

No mobile route changes in this increment.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None for this baseline endpoint.

## 7. Observability

- Standard API error handling via `apiHandler`.
- Contract parse will surface schema drift at runtime in non-happy paths.

## 8. Failure modes & fallbacks

- Missing/invalid token -> 401 via middleware.
- Missing user row for JWT subject -> 404 (`user not found`).
- Query or serialization failure -> standardized API error path.

## 9. Test plan

- Integration: unauthenticated request returns 401.
- Integration: authenticated request returns 200 and includes expected user-owned slices.
- Integration: ensure data from another user is not included.

## 10. Rollout plan

Ship directly; endpoint is additive and read-only.

## 11. Backout plan

Revert route and tests. No schema rollback required.
