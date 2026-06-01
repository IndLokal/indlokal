# IndLokal — Mobile App Audit (App vs Web)

- **Date:** 2026-06-01
- **Author:** Principal App Developer & Architect (acting Product + Engineering)
- **Status:** Audit v1 — drives the realignment of [`MOBILE_APP_STRATEGY.md`](./MOBILE_APP_STRATEGY.md)
- **Scope:** Audit the **current mobile app** (`apps/mobile`, Expo) against the **current web product** (`apps/web`, Next.js) and the product blueprints, identify what is good / bad / missing, define the **target product**, and queue the realignment.
- **Linked docs:** [`MOBILE_APP_STRATEGY.md`](./MOBILE_APP_STRATEGY.md), [`MOBILE_WEB_INTEGRATION.md`](./MOBILE_WEB_INTEGRATION.md), [`PRODUCT_DOCUMENT.md`](./PRODUCT_DOCUMENT.md), [`RBAC_AND_AUTHORIZATION.md`](./RBAC_AND_AUTHORIZATION.md), [`specs/AUDIT_PERSONAS_AND_INTERFACES.md`](./specs/AUDIT_PERSONAS_AND_INTERFACES.md), [`HOST_DASHBOARD.md`](./HOST_DASHBOARD.md)

> **One-line finding.** The mobile app is a well-built **consumer discovery app for the Member persona only**. The web has since grown into a **multi-console, role-scoped product** (public site + organizer + event host + ambassador + admin). The app has _swayed away from the product_: it ships none of the operator/organizer surfaces, ignores the role model it already carries in its auth token, and lags the web's public surfaces. This document is the audit; the realignment lands in the strategy and integration docs.

---

## 1. Method & sources

Audited directly from the code and blueprints, not from memory:

- Mobile surface: `apps/mobile/app/**`, `apps/mobile/lib/**`, `apps/mobile/constants/theme.ts`.
- Web surface: `apps/web/src/app/**` (public `[city]`, `organizer`, `organizer/host`, `ambassador`, `admin`, `me`, `api/v1`).
- Contracts & roles: `packages/shared`, `apps/web/prisma/schema.prisma`, `docs/specs/PRD/*`, `docs/specs/ADR/0005-role-and-scoped-permission-model.md`.
- Product intent: `docs/PRODUCT_DOCUMENT.md`, `docs/RBAC_AND_AUTHORIZATION.md`, `docs/specs/AUDIT_PERSONAS_AND_INTERFACES.md`.

---

## 2. Surface map — what each platform ships today

### 2.1 Web (`apps/web/src/app`)

| Console                   | Path                         | Auth / Role                                         | What it does                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public city site**      | `/[city]/...`                | Anonymous + Member                                  | City feed, events, communities, resources + journey, search, suggest, **business-events lens**, **consular-services**, **indian-events-this-week**, language/category SEO pages, save/follow                                    |
| **User account**          | `/me`                        | Member                                              | Profile, preferences (city, persona, languages), saved events/communities, **workspace hub** that routes to every console the user is entitled to                                                                               |
| **Organizer (community)** | `/organizer/(community)/...` | `COMMUNITY_ADMIN` / Collaborator                    | Multi-community **switcher**, dashboard with profile-completeness, edit profile + logo, manage access channels/links, **collaborators** (invite/promote/transfer/remove), events list + **create/edit**, moderation-state chips |
| **Event Host**            | `/organizer/host/...`        | `EVENT_HOST`                                        | Self-serve **start/signup**, dashboard with live/in-review/declined/past tiles, **unverified-event cap** tracking, post/edit events, host profile, "needs attention" for declined events                                        |
| **City Ambassador**       | `/ambassador/...`            | `CITY_AMBASSADOR` (city-scoped)                     | City dashboard (my submissions, pending pipeline, upcoming events, stale communities), **fast-track submit**, **event check-in** + (photo intent), **feedback**, **outreach CRM kanban**, **personal scoreboard**               |
| **Admin**                 | `/admin/(dashboard)/...`     | `PLATFORM_ADMIN` / `OPS_LEAD` / `PARTNERSHIPS_LEAD` | Submissions, claims, pipeline, scoring, data management, merge/dedup, reports, ambassadors, audit log, collaborators, outreach, team                                                                                            |
| **Public REST API**       | `/api/v1/...`                | JWT                                                 | The shared contract the mobile app already consumes                                                                                                                                                                             |

### 2.2 Mobile (`apps/mobile/app`)

| Area           | Screens                                                                                  | What it does                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Tabs**       | `(tabs)/index` Discover, `search`, `bookmarks` Saved, `me`                               | City picker, lens toggle (All / Business), trending "for you", search suggest + recents, saved events/communities, account menu     |
| **Detail**     | `events/[slug]`, `communities/[slug]`                                                    | Event detail (save → local reminder, share, add-to-calendar, maps, RSVP link), community detail (follow, share, upcoming + related) |
| **Auth**       | `auth/sign-in`, `auth/magic-link*`, `auth/onboarding/city`, `auth/onboarding/persona`    | Apple + Google + magic link; onboarding city + persona                                                                              |
| **Contribute** | `submit/{index,event,community,suggest}`, `report/community/[id]`                        | Text-only submission forms; report a community                                                                                      |
| **Engage**     | `inbox`, `settings/notifications`, `settings/notifications/quiet-hours`, push pre-prompt | In-app inbox + mark-all-read, per-topic × per-channel prefs, quiet hours, push permission pre-prompt                                |
| **Account**    | `me/profile` (read-only), `me/delete-account`, `resources/{index,journey}`               | View profile, delete account (grace period), city resources + journey                                                               |

**Mobile persona coverage:** `E2 — End User / Member` only.

---

## 3. Parity matrix — capability by persona

Legend: ✅ full · ◑ partial · ❌ absent · ➖ intentionally web-only

| Persona                                | Capability                                                        |      Web       | Mobile | Verdict                                                                 |
| -------------------------------------- | ----------------------------------------------------------------- | :------------: | :----: | ----------------------------------------------------------------------- |
| **Member (E2)**                        | Discover feed, search, save/follow                                |       ✅       |   ✅   | At parity                                                               |
| Member                                 | Resources + journey                                               |       ✅       |   ✅   | At parity                                                               |
| Member                                 | Submit event/community/suggest                                    |       ✅       |   ◑    | **Text-only on mobile; no image/camera upload**                         |
| Member                                 | Report content                                                    |       ✅       |   ◑    | Community report only; no event report                                  |
| Member                                 | Inbox + notification prefs + quiet hours                          |       ✅       |   ✅   | Mobile is ahead (push pipeline)                                         |
| Member                                 | Edit profile / preferences                                        |       ✅       |   ◑    | **Mobile profile is read-only**; prefs only set at onboarding           |
| Member                                 | Business-events lens                                              |       ✅       |   ◑    | Lens toggle exists; no dedicated consular-services / this-week surfaces |
| **Organizer (E3)**                     | Claim, multi-community switch, edit profile/links                 |       ✅       |   ❌   | **Missing entirely**                                                    |
| Organizer                              | Create/edit events, see moderation state                          |       ✅       |   ❌   | **Missing** (can only _submit_ via member form)                         |
| Organizer                              | Manage collaborators (invite/transfer/remove)                     |       ✅       |   ❌   | **Missing**                                                             |
| **Event Host (E4)**                    | Host signup, dashboard, cap tracking, manage events               |       ✅       |   ❌   | **Missing entirely**                                                    |
| **City Ambassador (I4)**               | City dashboard, fast-track submit, check-in, scoreboard, outreach |       ✅       |   ❌   | **Missing — and this is the most mobile-native persona of all**         |
| Ambassador                             | Event check-in + photo capture                                    |       ✅       |   ❌   | **Missing — should be app-first**                                       |
| **Ops / Partnerships / Admin (I1–I3)** | Moderation, pipeline, data, merge, audit                          |       ✅       |   ➖   | Stays web-only by design (see §6)                                       |
| **All roles**                          | Role-aware navigation / workspace switching                       | ✅ (`/me` hub) |   ❌   | **Token carries 9 roles; UI uses none**                                 |

---

## 4. What's GOOD (keep and build on)

1. **Solid consumer foundation.** Discover, search, saved, detail, follow/save, inbox and push are coherent and complete for the Member persona — the retention core the strategy is built around.
2. **Shared contract discipline.** The app consumes `/api/v1` via a typed client and `@indlokal/shared`; there is no second backend. This is the single most important asset for parity.
3. **Auth is genuinely strong.** Apple + Google + magic link, SecureStore tokens, silent refresh, and — critically — the **JWT already carries the full 9-role set** (`USER … PLATFORM_ADMIN`). The plumbing for role-aware UX is already present and unused.
4. **Notification pipeline is ahead of web.** Device registration, per-topic × per-channel prefs, quiet hours, in-app inbox, and a permission pre-prompt gated on a valuable action — exactly the retention engine the strategy demands.
5. **Design tokens mirror web brand.** `constants/theme.ts` reuses the web palette/typography/spacing, so visual drift is small and fixable.
6. **Spec-driven.** Mobile features already trace to PRD/TDD pairs (0003–0010), so realignment can extend the same workflow rather than invent one.

---

## 5. What's BAD or MISSING (fix)

### 5.1 Bad — quality/consistency gaps in shipped surfaces

- **Profile is read-only.** Members can set city/persona/languages only during onboarding; the web `/me` lets them edit anytime. Mobile should match.
- **Submissions are text-only.** The strategy explicitly promises _camera + gallery upload_ (`MOBILE_APP_STRATEGY.md §4.7`), but `submit/event` and `submit/community` post text only. This is a broken promise and a content-quality gap vs web.
- **Saved-event reminders are local-only.** Reminders are scheduled on-device, not server-driven, so they don't survive reinstall and don't reconcile with the server outbox. Acceptable for v1, but flagged.
- **Thin component library.** Screens use per-screen inline `StyleSheet`; there is no shared Button/Input/Card/EmptyState kit. This will not scale to organizer/host/ambassador surfaces.
- **Public-surface lag.** Web added `consular-services` and `indian-events-this-week` as first-class SEO/value surfaces; mobile has neither.

### 5.2 Missing — whole personas absent

- **No role-aware experience.** The app renders identically for a Member, an Organizer, a Host, and an Ambassador. The `/me` tab has no workspace hub. This is the central gap and the root cause of "the app swayed away from the product."
- **No Organizer surface.** A claimed organizer cannot edit their community, manage channels, manage collaborators, or create/manage events from the phone — the exact tasks they'd want to do on the go.
- **No Event Host surface.** No host signup, no dashboard, no cap visibility, no event management.
- **No City Ambassador field mode.** This is the sharpest miss: ambassadors are **inherently mobile, in the field** — check in at events, snap photos, fast-track a community they just discovered. Today they'd have to use the web form on a phone browser. The app should be their primary tool.

### 5.3 Strategy document drift

- `MOBILE_APP_STRATEGY.md` is **Draft v1, 22 April 2026**, written before the operator-team layer (ADR-0005, PRD-0014–0018) and before the organizer/host/ambassador consoles shipped on web. Its MVP scope (§4) and roadmap (§10) defer "organizer surface in-app" to Phase 2 and never mention event-host or ambassador parity as goals. The document no longer describes the product we are building.

---

## 6. What stays web-only (by design — not a gap)

Not everything should be mirrored. The following remain web-first and are **delegated**, not missing:

- **Admin console** (submissions, pipeline, scoring, data, merge, reports, team, audit). These are dense, desktop-shaped back-office tools used by a handful of internal operators. Mobile links out to them (in-app browser with auth handoff) rather than reimplementing them.
- **Heavy SEO surfaces** (language/category landing pages, `llms.txt`). Their job is search visibility; the app benefits from them via deep links, not by hosting them.
- **Bulk/CSV and multi-pane editing.** Better on a large screen.

The rule (see [`MOBILE_WEB_INTEGRATION.md`](./MOBILE_WEB_INTEGRATION.md)): **no surface is silently absent** — it is either native, or an explicit, authenticated hand-off to web.

---

## 7. Target product — how the app _should_ be

**Thesis:** App and web are **two faces of one role-aware product**, not two products. A person signs in once and the surface reshapes to _who they are_: Member, Organizer, Event Host, City Ambassador — each getting the slice of the product that fits the phone, with web as the heavy companion for back-office and SEO.

Target shape of the mobile app:

1. **Member (unchanged core, finished).** Discover/search/saved/detail/inbox at parity, **plus** editable profile, **image-enabled** submissions, and parity public surfaces (consular services, this-week).
2. **Role-aware shell.** The `Me` tab becomes a **workspace hub** mirroring web `/me`: it reads `RoleAssignment` scopes from the session and surfaces "Organizer", "Event Host", "Ambassador" entries only for entitled users — exactly as web already does.
3. **Organizer (lite, on-the-go).** Switch between claimed communities, edit profile/links, create/edit events, see moderation state, manage collaborators. Mirrors `/organizer/(community)` at a phone-appropriate depth; deep features (bulk, analytics) hand off to web.
4. **Event Host (lite).** Host home with live/in-review/declined tiles and cap visibility, post/edit an event, edit host profile. Mirrors `/organizer/host`.
5. **City Ambassador (app-first).** The flagship mobile-native surface: city dashboard, **fast-track submit with camera**, **event check-in with photo capture and geolocation**, feedback, personal scoreboard. The web console becomes the desk companion; the phone is the field tool.
6. **Admin & deep ops:** authenticated hand-off to web, never reimplemented.

Prioritization rationale: Member finishing work is small and high-value; **Ambassador field mode is the highest-leverage _new_ build** (most mobile-native persona, directly feeds the content pipeline); Organizer/Host lite follow; Admin stays delegated.

---

## 8. Prioritized gap backlog

| Priority | Gap to close                                                                                     | Persona            | Size | Notes                                                        |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------ | ---- | ------------------------------------------------------------ |
| **P0**   | Role-aware workspace hub in `Me` tab (read `RoleAssignment` scopes)                              | All                | S    | Unblocks every operator surface; plumbing already in token   |
| **P0**   | Editable profile + preferences (parity with web `/me`)                                           | Member             | S    | Closes a basic parity gap                                    |
| **P0**   | Image/camera upload in submissions (`uploads/presign`)                                           | Member, Ambassador | M    | Honors strategy §4.7; API exists (`/api/v1/uploads/presign`) |
| **P1**   | **City Ambassador field mode** (dashboard, fast-track submit, check-in + photo, scoreboard)      | Ambassador         | M–L  | Highest-leverage new build; app-first persona                |
| **P1**   | Organizer lite (multi-community switch, edit profile/links, event create/edit, moderation state) | Organizer          | M    | Mirrors `/organizer/(community)`                             |
| **P1**   | Shared mobile UI kit (Button/Input/Card/EmptyState/Form)                                         | All                | S–M  | Prerequisite for the operator surfaces                       |
| **P2**   | Event Host lite (home tiles, cap, event manage, host profile)                                    | Event Host         | M    | Mirrors `/organizer/host`                                    |
| **P2**   | Collaborator management on mobile (invite/transfer/remove)                                       | Organizer          | S    | Extends organizer lite                                       |
| **P2**   | Parity public surfaces (consular-services, indian-events-this-week) + event report               | Member             | S    | Closes public-surface lag                                    |
| **P2**   | Authenticated hand-off to web for admin/deep surfaces                                            | Ops/Admin          | S    | See integration doc                                          |
| **P3**   | Server-driven saved-event reminders via outbox                                                   | Member             | M    | Replace local-only reminders                                 |
| **P3**   | Widgets / Live Activities ("next event near you", event-day countdown)                           | Member             | M    | Already in strategy Phase 2                                  |

---

## 9. Recommended next actions (documents only — per current task)

1. **Realign `MOBILE_APP_STRATEGY.md`** to the §7 target product: add the role-aware/cross-surface thesis, restate MVP and roadmap to include organizer/host/ambassador parity, and correct the outdated Phase plan. _(Done in this change.)_
2. **Author `MOBILE_WEB_INTEGRATION.md`** defining the contract, identity, deep-link, design-token, role, notification, and analytics seams that keep app + web behaving as one product. _(Done in this change.)_
3. **Spec the gaps** as PRD/TDD pairs (next phase, not this task): Ambassador field mode, Organizer lite, Event Host lite, role-aware shell, image uploads, editable profile — each must state **both** web and mobile behavior per the parity rule.

---

**Bottom line:** Nothing in the mobile app is wrong; it is simply _incomplete relative to the product it belongs to_. It carries the role model, the shared contract, and the design tokens needed to become the role-aware front half of one product. The fix is not a rewrite — it is to make the app **role-aware**, finish Member parity, and build the **Ambassador-first** field experience, while keeping admin and SEO on web behind explicit hand-offs.
