# PRD-0059: GDPR Me Data Export (`GET /api/v1/me/export`)

- **Status:** Approved
- **Owner:** Auth/Platform
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0059, PRD-0019/TDD-0019

## 1. Problem

GDPR portability requires users to receive their account-linked data in a structured format. The current product supports account deletion but does not provide a user-level export endpoint.

## 2. Users & JTBD

- Authenticated user: "I want a downloadable/portable snapshot of my account-linked data without opening support tickets."
- Operations/legal: "We need a reliable portability path that is testable and repeatable."

## 3. Success Metrics

- Authenticated export endpoint returns 200 with schema-valid JSON payload.
- Unauthenticated requests return 401.
- Export contains core account-linked domains: profile, role/claim context, created content, saved items, user reports, notification preferences.

## 4. Scope

- Add `GET /api/v1/me/export` (Bearer auth).
- Return JSON payload shaped by shared contract `auth.MeDataExport`.
- Include only account-linked user data required for portability baseline.
- Exclude auth secrets (tokens, session token hashes, magic-link tokens, refresh tokens).

## 5. Out of Scope

- CSV packaging and archive downloads.
- Async export jobs/background pipelines.
- Admin-managed DSAR workflows and UI.

## 6. User Stories

- As an authenticated user, I can request a JSON export of my account-linked data.
- As an unauthenticated caller, I cannot access user export data.

## 7. Acceptance Criteria (Gherkin)

```
Given a valid Bearer token
When GET /api/v1/me/export is called
Then response status is 200
And response matches the MeDataExport schema
And response excludes auth/session secrets

Given no Bearer token
When GET /api/v1/me/export is called
Then response status is 401
```

## 8. UX

No new UI in this increment. Endpoint-first delivery for portability baseline.

## 9. Risks & Open Questions

- Export currently returns JSON only; if legal/commercial needs evolve, add CSV/zip in a follow-up.
