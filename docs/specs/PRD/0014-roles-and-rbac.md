# PRD-0014: Expanded roles, scoped assignments, and admin RBAC

- **Status:** Draft
- **Owner:** JP (Founder)
- **Reviewers:** X (Partnerships), Y (Ops), Eng Lead
- **Linked:** ADR-0005, PRD-0011 (magic-link auth), PRD-0012 (admin data console),
  PRD-0015 (Ambassador console), PRD-0016 (Outreach CRM)

## 1. Problem

The admin console is gated on a single `PLATFORM_ADMIN` role. As we add a
strategic partner (X), an ops/community-growth founding hire (Y), city
ambassadors, and a content intern, we cannot keep handing out platform-admin
access — it carries destructive write authority and no audit trail. We also
cannot scope ambassadors to a single city today.

## 2. Users & JTBD

- **Founder (JP)** — assign and revoke teammates without shell access.
- **X (Partnerships Lead)** — approve claims, run partner outreach, manage
  Resource directory; **must not** be able to delete cities or rotate auth.
- **Y (Ops Lead)** — onboard communities, manage outreach pipeline, run
  digests; same destructive guardrails.
- **City Ambassador** — see + queue submissions for _their_ city only.
- **Content Editor (intern)** — draft social/content highlights; no admin
  writes.
- **Engineer / AI support** — out of band (GitHub + DB read-only); no platform
  UI role.

## 3. Success Metrics

- 100 % of admin actions resolved through `can(user, action, resource)` (no
  call sites left checking `user.role === 'PLATFORM_ADMIN'`).
- Time to onboard a new ambassador (grant → first city-scoped login) < 5 min.
- Zero cross-city data writes by ambassadors in staging E2E suite.
- Audit log entry exists for every role grant and revoke (`role.granted`,
  `role.revoked`).

## 4. Scope

- New Prisma migration: expanded `UserRole` enum + `RoleAssignment` table per
  ADR-0005.
- `lib/auth/permissions.ts` — `can(user, action, resource)` helper, action
  catalog, role → action map.
- `lib/auth/with-role.ts` — server-action / route handler wrapper, replacing
  current `requirePlatformAdmin`.
- Admin UI:
  - `/admin/team` — list assignments, grant role with optional city/org scope,
    revoke. Visible to `PLATFORM_ADMIN` and `PARTNERSHIPS_LEAD` (read-only for
    the latter on platform-admin grants).
  - Sidebar items hide when the user lacks the action.
- Migration of every existing admin route to `can(...)`.
- Audit entries written to `ContentLog` (entityType `role_assignment`).

## 5. Out of Scope

- Full policy engine (Casbin / OPA) — see ADR-0005.
- Org / multi-tenant Partner Org accounts (covered by a future PRD).
- SSO / SCIM provisioning.
- Per-field-level redaction in the API.

## 6. User Stories

- As **JP**, I open `/admin/team`, search for a user by email, assign
  `CITY_AMBASSADOR` with `cityId = stuttgart`, and they immediately see the
  Ambassador console restricted to Stuttgart.
- As **Y**, I can approve pipeline items and edit communities, but the
  `/admin/data` destructive delete buttons are hidden for me.
- As an **Ambassador**, when I open `/admin/data` directly I get a 403 and a
  link to `/ambassador`.
- As **JP**, I revoke X's `PARTNERSHIPS_LEAD` role and the next request from X
  is denied; the audit log shows who revoked it and when.

## 7. Acceptance Criteria (Gherkin)

```
Given a user with RoleAssignment(role=CITY_AMBASSADOR, cityId=stuttgart)
When they POST /admin/communities/{id}/edit for a Munich community
Then the response is 403 and no write occurs

Given a user with RoleAssignment(role=OPS_LEAD)
When they call admin.deleteCity(...)
Then the request is denied and ContentLog records action=denied

Given platform admin grants RoleAssignment(role=CITY_AMBASSADOR, cityId=X)
Then a ContentLog row exists with action=role.granted, changedBy=adminId

Given an admin opens /admin/team without PLATFORM_ADMIN or PARTNERSHIPS_LEAD
Then they receive a 404 (do not advertise the route)
```

## 8. UX

- `/admin/team` table: email · primary role · scopes · granted by · granted at
  · actions (revoke).
- "Grant role" modal: user-search → role select → conditional city/org
  selectors based on role.
- Sidebar uses `can(user, 'admin.section.read', section)` to render entries.
- Empty/loading/error states per existing admin patterns.

## 9. Risks & Open Questions

- Migrating call sites is wide; we will land it behind a feature flag
  `rbac_v2` that flips per-route as it is converted, with a fallback to the
  legacy `PLATFORM_ADMIN` check.
- Do `OPS_LEAD` / `PARTNERSHIPS_LEAD` need pipeline auto-approval authority,
  or only manual? Default: manual approve only; auto-approval stays
  founder-only until thresholds tuned.
- City scope for ambassadors: single city only at v1, multi-city via multiple
  `RoleAssignment` rows.
