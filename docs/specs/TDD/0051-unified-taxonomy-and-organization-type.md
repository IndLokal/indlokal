# TDD-0051: Unified taxonomy + organization type

- **Status:** Implemented
- **Linked PRD:** PRD-0051
- **Owner:** Eng

## 1. Architecture overview

Add a single source-of-truth taxonomy in `packages/shared/src/config/community-options.ts` (already hosts
channels/personas/languages): add `ORGANIZATION_TYPE_VALUES` + labels and re-export via
`communityOptions`. Add a Prisma enum + nullable column. Wire the field through the organizer profile
action and admin import schema. Provide a best-effort backfill helper.

## 2. Data model changes

```prisma
enum OrganizationType {
  ASSOCIATION        // registered e.V. / formal association
  STUDENT_GROUP
  TEMPLE_RELIGIOUS
  CULTURAL_ORG
  PROFESSIONAL_NETWORK
  INSTITUTIONAL      // university/govt-adjacent/official
  INFORMAL_GROUP     // WhatsApp/Telegram-first informal community
  BUSINESS           // reserved; no business product is built
  OTHER
}

model Community {
  // ...
  organizationType OrganizationType? @map("organization_type")
  @@index([organizationType])
}
```

Migration: additive nullable column + index. No backfill in SQL; backfill is a guarded TS helper.

## 3. API surface

No new endpoint. `organizationType` added to:

- organizer profile update server action (Zod).
- admin community import schema (Zod).
  Shared enum exported from `@indlokal/shared`.

## 4. Mobile screens & navigation

None (additive; mobile may read the field later).

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None — additive nullable field; safe by construction.

## 7. Observability

`profile_updated` continues to fire; no new event required.

## 8. Failure modes & fallbacks

Null is always valid; classification is optional. Backfill never overwrites a non-null value.

## 9. Test plan

- Unit: shared enum exported + labels complete.
- Unit: backfill heuristic maps obvious signals (temple/student/association) and leaves ambiguous null.

## 10. Rollout plan

Apply migration → deploy → optional backfill run.

## 11. Backout plan

Column is nullable and unused by required paths; leaving it null is a no-op.
