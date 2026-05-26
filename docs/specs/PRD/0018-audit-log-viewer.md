# PRD-0018: Audit log viewer

- **Status:** Draft
- **Owner:** JP (Founder)
- **Reviewers:** X (Partnerships), Eng Lead
- **Linked:** PRD-0012 (admin data console), PRD-0014 (RBAC)

## 1. Problem

Every admin write already writes a row to `ContentLog` (see
`apps/web/prisma/schema.prisma`), but there is no UI to read it. As we add
more operators (X, Y, ambassadors), the founder needs a "who changed what,
when, from where" view without opening psql.

This is also a precondition for trusting role-scoped delegation in
PRD-0014 - granting `OPS_LEAD` to Y is only safe if reviewable.

## 2. Users & JTBD

- **JP (Founder)** - quickly answer "what happened to this community last
  week?" or "what did this teammate do today?".
- **X (Partnerships)** - review partner-org-impacting changes.
- **Eng / on-call** - incident triage when a user reports something missing.

## 3. Success Metrics

- 100 % of admin write actions visible in the viewer within 5 s of execution.
- Median time to answer "who changed entity X" question < 1 min (vs. running
  a SQL query).
- Zero PII leakage in audit metadata (verified by snapshot test).

## 4. Scope

- New route `/admin/audit` - paginated table of `ContentLog` rows.
- Filters: entityType, entityId, action, changedBy (user picker), date range.
- Row drawer: pretty-print `metadata` (diff if `previous`/`next` present),
  show actor email + role.
- "View entity" deep-link when `entityType` matches a known route.
- CSV export (≤ 10 000 rows, founder only).
- `RoleAssignment.granted` and `RoleAssignment.revoked` actions written into
  `ContentLog` with `entityType = 'role_assignment'` (covered by PRD-0014;
  this PRD just renders them).

## 5. Out of Scope

- Append-only / cryptographic chaining (overkill at our stage).
- Real-time stream / websocket - polling on demand is enough.
- Read-side audit (who _viewed_ what).
- Integration with external SIEM.

## 6. User Stories

- As **JP**, I open `/admin/audit`, filter by changedBy = Y, last 24 h, and
  see every action they took.
- As **X**, I open the entity drawer for a community claim and see who
  approved it and when.

## 7. Acceptance Criteria (Gherkin)

```
Given an admin updates a community description
Then a ContentLog row exists with action=UPDATED, entityType='community',
     changedBy=admin.userId, metadata containing the diff
And the row appears at the top of /admin/audit

Given a user without admin.audit.read permission
When they GET /admin/audit
Then they receive 403

Given the audit page filters changedBy=user-x and dateRange=last-7-days
Then only matching ContentLog rows are returned, ordered createdAt desc
```

## 8. UX

- Dense table, monospaced ids, hover-to-reveal full id.
- Color-coded action chips (CREATED, UPDATED, VERIFIED, ARCHIVED,
  SCORE_REFRESHED, role.granted, role.revoked).
- Drawer renders `metadata.diff` as side-by-side previous/next when present.
- Empty / loading / error per house style.

## 9. Risks & Open Questions

- `ContentLog` retention policy not yet defined; PRD assumes indefinite for
  now. Revisit if row count > 10 M.
- Some legacy writes may not log - track during PRD-0014 migration and add
  missing `recordContentLog(...)` calls as discovered.
- Indexing: existing `(entityType, entityId)` and `createdAt` cover the
  common filters; add `(changedBy, createdAt)` if user-filter is slow.
