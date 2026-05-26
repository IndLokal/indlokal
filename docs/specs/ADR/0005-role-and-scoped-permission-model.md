# ADR-0005: Role + scoped permission model (city / org)

- **Date:** 2026-05-11
- **Status:** Proposed

## Context

Today `User.role` is a single enum with three values - `USER`,
`COMMUNITY_ADMIN`, `PLATFORM_ADMIN` (see `apps/web/prisma/schema.prisma`).
Every admin route is gated on `PLATFORM_ADMIN`, which is fine while only the
founder operates the console.

The near-term team grid adds at least four new operating personas:

- **X - Partnerships & Community Lead** (strategic partner)
- **Y - Ops & Community Growth** (founding hire, JD attached)
- **City Ambassadors** (2-3 in Q3'26 → 15-20 by 2028, scoped to one city)
- **Content & Social Support** (PT intern from Q3'26)

We need:

1. Role separation so X and Y can do their jobs without shipping them
   `PLATFORM_ADMIN` (which today implies destructive DB power).
2. **Scoping** - a Stuttgart Ambassador must only see/edit Stuttgart data.
3. **Multi-tenancy hooks** - a future Partner Org (Consulate, university Indian
   Society, Indo-German chamber) owns N communities and N resources under one
   account. Schema must not paint us into a corner.
4. An audit trail for who granted what, and when it was revoked.

A single enum cannot express (city, org) scope; layering ad-hoc booleans onto
`User` would not scale to per-city ambassadors.

## Decision

Adopt a two-layer model:

1. **Expanded `UserRole` enum** capturing the operating roles:
   `USER`, `COMMUNITY_ADMIN`, `EVENT_HOST`, `PARTNER_ORG_ADMIN`,
   `CITY_AMBASSADOR`, `CONTENT_EDITOR`, `OPS_LEAD`, `PARTNERSHIPS_LEAD`,
   `PLATFORM_ADMIN`.
2. **`RoleAssignment` table** (one user → many roles, each scoped):
   `(userId, role, cityId?, orgId?, grantedBy, grantedAt, revokedAt?)`.

Authorization becomes: "user U has role R with scope S?" instead of
"`user.role === PLATFORM_ADMIN`?".

`User.role` is retained as the user's **primary** role for legacy callers and
display, but middleware authoritatively reads `RoleAssignment`.

A small server-side `can(user, action, resource)` helper centralizes checks
(action examples: `community.edit`, `pipeline.approve`, `outreach.write`,
`resource.publish`, `admin.audit.read`).

## Consequences

- **Positive**
  - Ambassadors can be city-scoped without DB superuser power.
  - X and Y get separate, recordable scopes; rotating someone off is a
    `revokedAt` write, not a role downgrade.
  - Future Partner Org accounts (E5 in the persona audit) drop in via `orgId`.
  - Audit-friendly: `grantedBy` + `revokedAt` answer "who let them in?".
- **Negative**
  - All admin route guards must be migrated from "is platform admin" to
    `can(...)`. One-off code-mod, but every admin file is touched.
  - One more table to keep in sync with `User`.
- **Neutral**
  - `User.role` becomes a view of "primary" assignment; we document that
    business logic must not branch on it.

## Alternatives considered

- **Stay on a single enum, add booleans (`isAmbassador`, `cityScope`)** -
  simplest now but cannot model multi-city ambassadors or partner orgs without
  reworking again within the year.
- **Full Casbin/OPA policy engine** - overkill for the team size; we will
  re-evaluate when we hit ~10 internal seats or when the partner org tier
  ships.
- **Per-role boolean flags on `User`** - same scaling problem as the enum-only
  approach and produces a sparse, hard-to-query schema.
