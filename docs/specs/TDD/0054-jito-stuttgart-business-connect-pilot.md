# TDD-0054: JITO Stuttgart × IndLokal Business Connect pilot

- **Status:** Approved
- **Linked PRD:** PRD-0054
- **Owner:** Founders

## 1. Architecture overview

Web-only, server-action based (no `/api/v1` endpoint, no mobile, no push). Access is **invite-only**:
the pilot's community organizer issues per-email invites, and only a valid invite token unlocks the
form. Four surfaces over two private tables:

```
Landing   /jito-stuttgart/business-connect         (RSC + 1 client page-view tracker; noindex)
Form      /jito-stuttgart/business-connect/submit  (invite-gated; client form → server action; noindex)
Organizer /organizer/business-connect              (RSC, community-scoped; invites + primary review)
Admin     /admin/business-connect                  (RSC, RBAC-gated read-only oversight)
                          │
                          ▼
        db.businessConnectInvite      (Postgres, private; per-email access tokens)
        db.businessConnectSubmission  (Postgres, private; no public read path; linked via inviteId)
```

Components touched:

- Landing — [apps/web/src/app/jito-stuttgart/business-connect/page.tsx](apps/web/src/app/jito-stuttgart/business-connect/page.tsx),
  [BusinessConnectPageView.tsx](apps/web/src/app/jito-stuttgart/business-connect/BusinessConnectPageView.tsx)
- Form — [submit/page.tsx](apps/web/src/app/jito-stuttgart/business-connect/submit/page.tsx),
  [submit/SubmitBusinessConnectForm.tsx](apps/web/src/app/jito-stuttgart/business-connect/submit/SubmitBusinessConnectForm.tsx)
- Submit action + validation — [submit/actions.ts](apps/web/src/app/jito-stuttgart/business-connect/submit/actions.ts),
  [schema.ts](apps/web/src/app/jito-stuttgart/business-connect/schema.ts)
- Invite token helpers — [invite.ts](apps/web/src/app/jito-stuttgart/business-connect/invite.ts)
- Organizer invite surface — [organizer/(community)/business-connect/page.tsx](<apps/web/src/app/organizer/(community)/business-connect/page.tsx>),
  [organizer/(community)/business-connect/actions.ts](<apps/web/src/app/organizer/(community)/business-connect/actions.ts>),
  [organizer/(community)/business-connect/BusinessConnectInviteCard.tsx](<apps/web/src/app/organizer/(community)/business-connect/BusinessConnectInviteCard.tsx>)
- Pilot constants/taxonomy — [options.ts](apps/web/src/app/jito-stuttgart/business-connect/options.ts),
  [pilot.ts](apps/web/src/app/jito-stuttgart/business-connect/pilot.ts) (`communitySlug` links the pilot to its community)
- Admin — [admin/(dashboard)/business-connect/page.tsx](<apps/web/src/app/admin/(dashboard)/business-connect/page.tsx>)
- Cross-cutting — [lib/auth/permissions.ts](apps/web/src/lib/auth/permissions.ts),
  [lib/auth/community-permissions.ts](apps/web/src/lib/auth/community-permissions.ts) (`canInviteCommunityCollaborators`),
  [lib/rate-limit.ts](apps/web/src/lib/rate-limit.ts),
  [lib/analytics/events.ts](apps/web/src/lib/analytics/events.ts)

## 2. Data model changes

New enum + two models in [prisma/schema.prisma](apps/web/prisma/schema.prisma): the submission table
`business_connect_submissions` and the per-email access table `business_connect_invites`.

```prisma
enum BusinessConnectStatus { NEW REVIEWED SHORTLISTED MATCHED REJECTED ARCHIVED }

model BusinessConnectSubmission {
  id                              String                @id @default(cuid())
  pilotSlug                       String                @map("pilot_slug")
  participantType                 String                @map("participant_type")
  lookingFor                      String[]              @map("looking_for")
  lookingForOther                 String?               @map("looking_for_other")
  offering                        String[]
  offeringOther                   String?               @map("offering_other")
  companyName                     String                @map("company_name")
  country                         String
  city                            String
  industry                        String
  businessDescription             String                @map("business_description")
  specificAsk                     String                @map("specific_ask")
  contactName                     String                @map("contact_name")
  contactEmail                    String                @map("contact_email")
  website                         String?
  linkedinUrl                     String?               @map("linkedin_url")
  phone                           String?
  preferredGeography              String?               @map("preferred_geography")
  attendingEvent                  String                @map("attending_event")
  isPartnerMember                 String                @map("is_partner_member")
  referredBy                      String?               @map("referred_by")
  associatedChapterOrOrg          String?               @map("associated_chapter_or_org")
  consentToReview                 Boolean               @map("consent_to_review")
  consentManualIntroUnderstanding Boolean               @map("consent_manual_intro_understanding")
  consentToShareSelectedInfo      Boolean   @default(false) @map("consent_to_share_selected_info")
  consentPolicyVersion            String                @map("consent_policy_version")
  emailConfirmationTokenHash      String?   @unique @map("email_confirmation_token_hash")
  emailConfirmedAt                DateTime?             @map("email_confirmed_at")
  inviteId                        String?   @unique @map("invite_id")
  invite                          BusinessConnectInvite? @relation(fields: [inviteId], references: [id], onDelete: SetNull)
  status                          BusinessConnectStatus @default(PENDING_CONFIRMATION)
  adminNotes                      String?               @map("admin_notes")
  matchNotes                      String?               @map("match_notes")
  createdAt                       DateTime  @default(now()) @map("created_at")
  updatedAt                       DateTime  @updatedAt @map("updated_at")

  @@index([pilotSlug, status, createdAt])
  @@index([status, createdAt])
  @@map("business_connect_submissions")
}

model BusinessConnectInvite {
  id              String                     @id @default(cuid())
  pilotSlug       String                     @map("pilot_slug")
  email           String
  tokenHash       String                     @unique @map("token_hash")
  communityId     String                     @map("community_id")
  community       Community                  @relation(fields: [communityId], references: [id], onDelete: Cascade)
  invitedByUserId String                     @map("invited_by_user_id")
  invitedBy       User                       @relation("BusinessConnectInviteInvitedBy", fields: [invitedByUserId], references: [id], onDelete: Cascade)
  note            String?
  expiresAt       DateTime                   @map("expires_at")
  usedAt          DateTime?                  @map("used_at")
  createdAt       DateTime  @default(now())  @map("created_at")
  submission      BusinessConnectSubmission?

  @@index([communityId, createdAt])
  @@index([pilotSlug, email])
  @@map("business_connect_invites")
}
```

Design choices:

- **Invite-only access.** `BusinessConnectInvite` is a per-email access token issued by the pilot's
  community organizer. Only the SHA-256 `tokenHash` is stored (raw token lives only in the emailed
  link, like the confirmation token). An invite is usable while `usedAt` is null and `expiresAt` is
  in the future (30-day TTL). `inviteId` on the submission is a unique back-reference (one invite →
  at most one submission); the invite is consumed atomically with the insert (see §3).
- Enums-as-strings for `participantType`, `lookingFor`, `offering`, `attendingEvent`,
  `isPartnerMember` — these are **pilot taxonomies**, intentionally not promoted to platform enums in
  `@indlokal/shared`. Only the review `status` is a real Prisma enum (stable lifecycle).
- Multi-selects stored as `String[]` (Postgres text arrays), matching the form's `getAll(...)`.
- `consentPolicyVersion` records the privacy-notice version at collection time for GDPR
  auditability, aligning with the PRD-0033 PII-notice baseline. It is a required column with no DB
  default — the value is always supplied per-pilot by the application from the pilot registry, so the
  schema carries no pilot-specific string.
- The membership field is the pilot-agnostic `isPartnerMember` (`is_partner_member`); the
  JITO-specific phrasing ("Are you a JITO member?") is a per-pilot label in the registry, not a
  column name.
- Indexes support review views ordered by `createdAt desc`, optionally scoped by `pilotSlug` /
  `status`.

Migrations:

- `20260605120000_business_connect_submission` — single migration that creates the enum (with the
  system-only `PENDING_CONFIRMATION` lifecycle entry), the `business_connect_submissions` table
  (already pilot-generic: `is_partner_member`, `consent_policy_version`) including the
  double-opt-in columns `email_confirmation_token_hash` (unique) and `email_confirmed_at` and the
  `invite_id` (unique) back-reference, the `business_connect_invites` table (per-email access
  tokens: `token_hash` unique, `community_id` → communities CASCADE, `invited_by_user_id` → users
  CASCADE), and their indexes/foreign keys (submissions.invite_id → invites SET NULL). One folded
  migration, no JITO-specific names or defaults, and no separate email-verification table — email
  confirmation lives on the submission row itself.

## 3. API surface

**No public/REST API.** All reads and writes go through Next.js Server Actions; there is
deliberately no public read path for submission data.

| Action                          | File                                        | Auth                                        | Input                                                                | Effect                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inviteBusinessConnectGuest`    | `organizer/.../business-connect/actions.ts` | community `canInviteCommunityCollaborators` | `FormData` (`emails`, optional `note`)                               | Validates emails, creates a `BusinessConnectInvite` per new address (hashed token, 30-day expiry), emails each invite link                                                                                  |
| `submitBusinessConnect`         | `submit/actions.ts`                         | Invite token + rate limits                  | `FormData` (incl. `inviteToken`) → `businessConnectSubmissionSchema` | Resolves+validates the invite, then in one transaction marks the invite used and inserts the row as `PENDING_CONFIRMATION` (email locked to the invite), and emails a **confirmation link** (double opt-in) |
| `confirmBusinessConnectEnquiry` | `confirm/actions.ts`                        | Public (token-bearing)                      | `FormData` (`token`)                                                 | Verifies the confirmation token, promotes the row to `NEW`, sets `emailConfirmedAt`, and fires confirmation/notification emails                                                                             |
| `updateBusinessConnectStatus`   | `organizer/.../business-connect/actions.ts` | community `canInviteCommunityCollaborators` | `id`, `status`                                                       | Organizer-only status update for submissions tied to the pilot community's invites; revalidates organizer + admin pages                                                                                     |
| `updateBusinessConnectNotes`    | `organizer/.../business-connect/actions.ts` | community `canInviteCommunityCollaborators` | `id`, `adminNotes`, `matchNotes`                                     | Organizer-only notes update for submissions tied to the pilot community's invites; revalidates organizer + admin pages                                                                                      |

**Invite-only access gate (trust).** Business Connect is not on the open web. The pilot is linked to
a community via `pilot.communitySlug`; the community organizer (a `COMMUNITY_ADMIN` of that
community, per ADR-0008 — not the platform admin) issues per-email invites at
`/organizer/business-connect`, authorized by `canInviteCommunityCollaborators`. The submit page and
action both require a valid invite:

- **Gate the form** — `submit/page.tsx` reads `?invite=<token>`, hashes it (`hashToken`), looks up
  the `BusinessConnectInvite`, and renders the form only if the invite `isInviteUsable` (unused +
  unexpired). Otherwise it shows an invite-only notice. The pilot is resolved from the invite, and
  the contact-email field is locked (read-only) to `invite.email`.
- **Lock + consume on submit** — `submitBusinessConnect` re-resolves the invite server-side, forces
  `contactEmail = invite.email` (the posted value is never trusted) and the pilot from
  `invite.pilotSlug`, then in a single `db.$transaction` `updateMany`s the invite to set `usedAt`
  (guarded by `usedAt: null, expiresAt > now`) and, only if that claimed exactly one row, inserts
  the submission with `inviteId`. A losing race throws `INVITE_CONSUMED`, so one invite admits
  exactly one submission.
- **Invite token helpers** — [invite.ts](apps/web/src/app/jito-stuttgart/business-connect/invite.ts)
  (`server-only`): `generateInviteToken` (32 random bytes → 64-char hex), `buildInviteUrl`,
  `inviteExpiresAt` (30-day TTL), `isInviteUsable`.

Invite-only gating and double opt-in are **both** retained: the invite controls _access_, the
confirmation link still proves the email is _reachable_.

**Email confirmation gate (trust).** There is no public web account, so before an enquiry reaches
the review queue the submitter must prove they own the contact email via **double opt-in**:

1. **Submit** — validate the enquiry (Zod), then persist the row as `PENDING_CONFIRMATION` with a
   random confirmation token (`confirmation.ts` → `generateConfirmationToken`, hashed with
   `hashToken` and stored as `emailConfirmationTokenHash`; 14-day validity). A one-time
   **confirmation link** is emailed (`sendBusinessConnectConfirmEmail`). The success state tells the
   submitter to check their inbox; nothing is shared until they confirm.
2. **Confirm** — the link opens `confirm/page.tsx`, which shows a POST button (robust against email
   link prefetch/scanners). `confirmBusinessConnectEnquiry` re-hashes the token, looks up the row,
   checks freshness, and on success sets `emailConfirmedAt` and promotes `status` to `NEW`. Re-clicks
   are idempotent (`?state=done`). Only then do the confirmation + team-notification emails fire.

Rate limits: per-IP submissions via `businessConnectLimiter` (loose, event-WiFi friendly). The
token is single-use (unique hash, cleared/ignored once `emailConfirmedAt` is set) with a 14-day
window, so there is no code to brute force. Email ownership raises the trust floor, but the
**manual organizer review remains the ultimate gate** — confirmation only proves the address is
reachable.

Validation source of truth: `schema.ts` (Zod). Required fields non-empty; `contactEmail` is locked
server-side to the invite address (the form field is read-only); free-text capped (descriptions ≤
1500, "other" ≤ 200); `lookingFor`/`offering` ≥ 1; conditional "Other" requires its free-text;
`consentToReview` and `consentManualIntroUnderstanding` must be literal `true`;
`consentToShareSelectedInfo` defaults `false`.

Review authority is community-scoped via
[lib/auth/community-permissions.ts](apps/web/src/lib/auth/community-permissions.ts):
`canInviteCommunityCollaborators(user, communityId)` gates both invite issuance and status/notes
mutations in organizer Business Connect actions. Admin page visibility remains gated by
`business_connect.read` for oversight.

## 4. Mobile screens & navigation

None. Web-only pilot; no Expo Router paths, no deep links.

## 5. Push / Email / Inbox triggers

Transactional email (no push/inbox), all via [lib/email.ts](apps/web/src/lib/email.ts). The
confirmation link gates review; the other two are best-effort and fire only after confirmation:

- **`sendBusinessConnectConfirmEmail`** — one-time double-opt-in confirmation link to the submitter
  (required before the enquiry enters the review queue). All values HTML-escaped; the link is
  `encodeURI`-d.
- **`sendBusinessConnectConfirmationEmail`** — confirmation to the submitter once the link is
  clicked and the enquiry is promoted to `NEW` (non-blocking).
- **`sendBusinessConnectAdminNotificationEmail`** — notify the organizer reviewer (invite issuer
  email first; fallback `BUSINESS_CONNECT_NOTIFY_EMAIL` → `ADMIN_EMAIL` → `RESEND_FROM_EMAIL`) with
  a deep link to the organizer queue (non-blocking).

Delivery failures of the confirmation/notification emails never fail the flow; a failed
confirmation-link email can be retried by re-submitting (the link is re-issued). No
`EVENTS/notifications.md` rows (web-only, direct transactional send).

## 6. Feature flags

None. The pilot lives on dedicated, low-traffic routes and the admin surface is RBAC-gated, so a
flag adds no meaningful kill-switch value over removing the route link. Kill-switch in practice:
revoke the RBAC grants and/or unlink the public route.

## 7. Observability

- Analytics (PostHog) via [lib/analytics/events.ts](apps/web/src/lib/analytics/events.ts) —
  `business_connect_page_view`, `business_connect_submit_started`, `business_connect_submit_success`,
  `business_connect_submit_error`. Properties limited to `pilotSlug`, `participantType`,
  `attendingEvent`, `isPartnerMember`, and an error `reason` (`rate_limited` | `validation` |
  `persist_failed`). **No free-text business data is ever sent to analytics.**
- Server errors on insert are caught and surfaced as a generic user error + a
  `business_connect_submit_error` event; raw enquiry content is not logged.

## 8. Failure modes & fallbacks

- **Validation failure** → field errors returned to the form; `submit_error{reason:validation}`.
- **Missing / invalid / expired / already-used invite** → the submit page renders an invite-only
  notice (no form); a submit attempt returns an "invite-only" or "invite no longer valid" error and
  nothing is persisted. A lost consume race throws `INVITE_CONSUMED` and is surfaced as an
  already-used error.
- **Rate limited** (per-IP `businessConnectLimiter`) → friendly "try again later" on the form;
  `submit_error{reason:rate_limited}`.
- **Invalid / expired / already-used confirmation link** → the confirm page renders an `invalid`
  (or idempotent `done`) state inviting a re-submit; the row stays `PENDING_CONFIRMATION` and is
  never surfaced to admins.
- **Confirmation email fails to send** → non-fatal; the submitter can re-submit to re-issue the link.
- **DB insert failure** → generic error to user; `submit_error{reason:persist_failed}`; no partial state.
- **Unauthorized admin access** → `requireCan`/`assertCan` throw/redirect per platform RBAC; no data leaks.
- **Missing IP header** → falls back to `'unknown'` for rate-limit/analytics keying.

## 9. Test plan

- **Unit:** `businessConnectSubmissionSchema` — required fields, email validity, consent literals,
  conditional "Other" refinement, max-length caps. `generateConfirmationToken` / `generateInviteToken`
  — always a 64-char lowercase hex string and unique across draws; `isConfirmationFresh` honours the
  14-day window; `isInviteUsable` is true only when unused and unexpired (false once used, expired,
  or exactly at expiry); `buildConfirmationUrl` / `buildInviteUrl` produce a single-slash absolute
  URL with an encoded token; `inviteExpiresAt` is 30 days out.
- **Integration (action):** `inviteBusinessConnectGuest` creates one invite per new email (hashed
  token, 30-day expiry) and skips emails with a live invite; a valid invite-gated `FormData` writes
  a row as `PENDING_CONFIRMATION` with `inviteId` and `contactEmail = invite.email`, marks the
  invite used, and emails the confirmation link; a used/expired invite is rejected with no write;
  `confirmBusinessConnectEnquiry` with a valid token promotes the row to `NEW`, sets
  `emailConfirmedAt`, and fires the confirmation/notification emails; an invalid/expired token leaves
  the row untouched; invalid consent rejects before any write.
- **Authz:** `/organizer/business-connect` issues invites and updates status/notes only for
  `canInviteCommunityCollaborators` on the pilot's community; `/admin/business-connect` denies users
  lacking `business_connect.read` (oversight only).
- **Privacy:** assert no public route/loader returns submission data; the landing, submit, and admin
  pages are `noindex` (`metadata.robots`).
- **E2E (Playwright web):** landing → submit → success path; admin status update reflects in list.
- Contract (Pact/OpenAPI) and k6: **N/A** — no new public endpoint.

## 10. Rollout plan

1. Apply migration `20260605120000_business_connect_submission`; `prisma generate`.
2. Deploy; grant `PARTNERSHIPS_LEAD` / `OPS_LEAD` to the operators who will review.
3. Verify on staging: as the JITO Stuttgart community organizer, send a test invite from
   `/organizer/business-connect`; open the invite link, submit a test enquiry, and confirm the row
   is created as `PENDING_CONFIRMATION` with `inviteId` set and `contactEmail` equal to the invited
   address, the invite is marked used, and the row is not visible in the organizer queue until
   confirmed; click the
   double-opt-in link (Mailpit in dev), confirm the row promotes to `NEW` with `emailConfirmedAt` and
   `consentPolicyVersion` set, confirm the confirmation + team-notification emails, confirm the
   organizer queue status/notes updates and admin oversight visibility, confirm reusing the invite is
   rejected, confirm a tokenless
   `/submit` shows the invite-only notice, confirm non-admin denial, confirm analytics events carry
   no free text.
4. The JITO Stuttgart community organizer invites guests by email for the 23 June event (no public
   link is shared).

No staged % rollout needed (single low-traffic route, RBAC-gated admin).

**Discoverability.** Business Connect is **invite-only and intentionally undiscoverable**: there is
no homepage band and no footer link, and the landing + submit routes are `noindex`. Access comes
only from an organizer-issued per-email invite link. The active pilot is linked to its community via
`pilot.communitySlug`, and the organizer nav entry (`/organizer/business-connect`) appears only for
organizers of that community — a future pilot redirects by updating the registry, not these surfaces.

## 12. Generalization seam (avoid JITO lock-in)

The pilot is a JITO PoC, but the **engine is pilot-agnostic** so a future pilot — another event, or
a broader IndLokal Business intake — is additive, not a fork:

- **Pilot registry** — [pilot.ts](apps/web/src/app/jito-stuttgart/business-connect/pilot.ts) defines
  `BusinessConnectPilot` + `BUSINESS_CONNECT_PILOTS` keyed by slug, with `ACTIVE_BUSINESS_CONNECT_PILOT`
  and `getBusinessConnectPilot(slug)`. Per-pilot identity (slug, `partnerName`, `eventLabel`,
  `routePath`, `communitySlug`, `membershipQuestion`, `consentPolicyVersion`) lives here — nowhere
  else. `communitySlug` links the pilot to the community whose organizer issues its invites.
- **Pilot-aware action** — `submitBusinessConnect` resolves the pilot from a hidden, **allowlisted**
  `pilotSlug` field (unknown/absent → active pilot), so one action serves every pilot without
  trusting arbitrary client input.
- **Prop-driven form** — `SubmitBusinessConnectForm` takes a `pilot` prop; all partner/event/
  membership copy comes from config. A second pilot renders the same component with its own config.
- **Generic data model** — names are pilot-neutral (`BusinessConnectSubmission`, `pilotSlug`,
  string taxonomies, `business_connect.*` RBAC, `business_connect_*` analytics). The membership
  column is the generic **`is_partner_member`** from the start; the JITO wording is only a per-pilot
  `membershipQuestion` label. `consent_policy_version` is a required column with no DB default — the
  value is supplied per-pilot by the application, so no pilot string is baked into the schema.
- **Pilot-aware admin** — the review queue shows a pilot badge per row
  (`businessConnectPilotLabel`) and uses the neutral "Member" label; a `pilotSlug` filter is a
  trivial additive change.
- **Per-pilot route + copy stays bespoke by design** — trust-first pilots want partner-branded
  landing pages, so each pilot owns a thin route folder (e.g. `/jito-stuttgart/business-connect`)
  that renders the shared engine. This is intentional, not coupling.

**What is intentionally still shared/deferred:** the taxonomy option lists
([options.ts](apps/web/src/app/jito-stuttgart/business-connect/options.ts)) are India–Germany
Business-Connect defaults reused across pilots; per-pilot taxonomy overrides are an additive field
on `BusinessConnectPilot` when a pilot first needs them (YAGNI until then). This stays a curated,
gated pilot — not the open Phase 5/6 product.

## 13. Backout plan

- Stop new submissions by revoking the organizer's invite ability (or unlinking the route); existing
  invites also expire on their own 30-day TTL.
- Revoke the RBAC grants to close the admin surface.
- Data is retained privately; no destructive teardown. If the pilot is abandoned, drop the
  `business_connect_invites` and `business_connect_submissions` tables via a forward migration (no
  other model references them — safe, isolated).
