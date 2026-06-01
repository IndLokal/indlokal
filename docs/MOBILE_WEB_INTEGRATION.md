# IndLokal — Mobile ⇄ Web Integration (One Product, Two Surfaces)

- **Date:** 2026-06-01
- **Author:** Principal App Developer & Architect
- **Status:** Blueprint v1 — companion to [`MOBILE_APP_STRATEGY.md`](./MOBILE_APP_STRATEGY.md) and [`MOBILE_APP_AUDIT.md`](./MOBILE_APP_AUDIT.md)
- **Scope:** Define how the Expo app (`apps/mobile`) and the Next.js web (`apps/web`) stay **deeply integrated** so users experience **one product**, not two. This is the durable integration blueprint; individual seams are specified per-feature as PRD/TDD pairs.

> **Principle.** IndLokal is **one product with two surfaces**. Web is the SEO + back-office + heavy-management surface; mobile is the recall + field + on-the-go surface. A user signs in once, and the product reshapes to _who they are_ and _which device they hold_ — never to _which codebase they happened to open_.

---

## 1. The seven integration seams

Two surfaces feel like one product only if they share the layers below. Each seam has a single source of truth.

| #   | Seam                             | Source of truth                                            | Status today     | Target                                        |
| --- | -------------------------------- | ---------------------------------------------------------- | ---------------- | --------------------------------------------- |
| 1   | **Contract** (API shapes)        | `packages/shared` Zod → OpenAPI; `apps/web/src/app/api/v1` | ✅ shared        | Keep: every new field lands in `shared` first |
| 2   | **Identity & session**           | `/api/v1/auth/*` JWT (web + mobile)                        | ✅ shared        | Keep + add cross-surface hand-off (§3)        |
| 3   | **Authorization** (roles/scopes) | `RoleAssignment` + `prisma` enum + ADR-0005                | ◑ web-only UI    | Drive **both** UIs from the same scopes (§4)  |
| 4   | **Deep links** (URL ⇄ route)     | `indlokal.com/[city]/...` universal/app links              | ◑ partial        | Full URL⇄screen map + hand-off (§5)           |
| 5   | **Design tokens**                | web theme ↔ `apps/mobile/constants/theme.ts`               | ◑ mirrored copy  | Promote to shared `ui-tokens` (§6)            |
| 6   | **Notifications & inbox**        | `/api/v1/notifications/*` + outbox                         | ✅ server-driven | Keep; reconcile local reminders (§7)          |
| 7   | **Analytics events**             | `docs/specs/EVENTS/analytics.md`                           | ◑ partial        | One typed catalog, same names both sides (§8) |

---

## 2. Contract: one backend, one schema

- There is **exactly one backend** (`apps/web/src/app/api/v1`) and **one contract package** (`@indlokal/shared`). The mobile app must never grow its own API or duplicate types.
- **Rule:** any request/response change is a Zod edit in `packages/shared`, exported to OpenAPI, _then_ consumed by both web data loaders and the mobile client. Contract drift should fail CI.
- **Versioning:** breaking changes bump `/api/vN` and require an ADR; surfaces upgrade together.
- **Benefit:** parity is structural — a field cannot exist on web and silently not on mobile, because both read the same schema.

---

## 3. Identity & session: sign in once

- **Same auth, same tokens.** Web and mobile both authenticate against `/api/v1/auth/{apple,google,magic-link,refresh}` and receive the same JWT (access + refresh). The JWT already carries the full role set.
- **Magic link is the bridge.** A magic link opened on a phone should resolve into the app (via universal/app link) and into web otherwise — same token, same account, no re-login.
- **Cross-surface hand-off (target).** When a surface hands the user to the other (e.g. app → web admin, web → "open in app"):
  - Web → App: deep link carries enough to resume; app exchanges/refreshes its own session — **never** put long-lived secrets in a URL.
  - App → Web: open an in-app browser with a **short-lived, single-use** session-exchange token so the user lands authenticated, not at a login wall.
- **Single account model.** Onboarding (city/persona/languages), saves, follows, and preferences live on the server (`/api/v1/me`), so they are identical the moment a user switches device.

---

## 4. Authorization: one role model drives both UIs

- **Source of truth:** `RoleAssignment` (role + optional `cityId`/`orgId` scope) per ADR-0005 and [`RBAC_AND_AUTHORIZATION.md`](./RBAC_AND_AUTHORIZATION.md). Enforcement is always **server-side** on every action; UI gating is convenience only.
- **Parity requirement:** the same scopes that reveal a console on web `/me` must reveal the matching workspace on the mobile `Me` hub. Today the mobile token carries the roles but the UI ignores them — closing this is **P0** in the audit.
- **Capability mapping (web console → mobile surface):**

  | Role / scope                                    | Web console              | Mobile surface                                       |
  | ----------------------------------------------- | ------------------------ | ---------------------------------------------------- |
  | `COMMUNITY_ADMIN` / Collaborator                | `/organizer/(community)` | Organizer lite (switch, edit, events, collaborators) |
  | `EVENT_HOST`                                    | `/organizer/host`        | Event Host lite (tiles, cap, manage)                 |
  | `CITY_AMBASSADOR` (+`cityScopes`)               | `/ambassador`            | **Ambassador field mode** (app-first)                |
  | `OPS_LEAD`/`PARTNERSHIPS_LEAD`/`PLATFORM_ADMIN` | `/admin/(dashboard)`     | Authenticated hand-off to web                        |

- **City scope travels with the surface:** an ambassador for Stuttgart sees Stuttgart on both web and mobile, enforced by the same `RoleAssignment.cityId`.

---

## 5. Deep links: every place exists on both surfaces

The **"no orphan surface"** rule: every meaningful destination is reachable by a single canonical URL, and that URL resolves natively where the app implements it, or hands off to web where it doesn't.

- **Universal Links / App Links:** `indlokal.com/[city]/events/[slug]`, `/[city]/communities/[slug]`, `/[city]/resources/...`, etc. open the app when installed and the web page otherwise. Both render the same entity from the same API.
- **URL ⇄ screen map (maintained as the app grows):**

  | Canonical URL                | Mobile route                   | If not native yet                        |
  | ---------------------------- | ------------------------------ | ---------------------------------------- |
  | `/[city]`                    | `(tabs)/index` (city set)      | —                                        |
  | `/[city]/events/[slug]`      | `events/[slug]`                | —                                        |
  | `/[city]/communities/[slug]` | `communities/[slug]`           | —                                        |
  | `/[city]/resources`          | `resources/index`              | —                                        |
  | `/me`                        | `(tabs)/me` (workspace hub)    | —                                        |
  | `/organizer/...`             | Organizer lite (target)        | in-app browser hand-off until native     |
  | `/ambassador/...`            | Ambassador field mode (target) | in-app browser hand-off until native     |
  | `/admin/...`                 | —                              | **always** authenticated hand-off to web |

- **Share parity:** server-rendered OG cards (web) are the share artifact for both surfaces, so a link shared from the app opens a rich preview and routes back into app/store.
- **Fallback contract:** a surface the app hasn't built yet must **hand off authenticated to web**, never dead-end. A surface the app _has_ built must be reachable from the matching web URL.

---

## 6. Design tokens: one visual language

- Today `apps/mobile/constants/theme.ts` **mirrors** the web brand (palette, typography, spacing, radius). Mirroring drifts over time.
- **Target:** promote the brand primitives in [`docs/brand/`](./brand/) to a shared `packages/ui-tokens` consumed by both web (Tailwind theme) and mobile (`theme.ts`), so a brand change updates both surfaces from one place.
- Component intent (button shapes, card elevation, empty/loading/error states) should match conceptually; pixel-identical is not required, but a user must recognize the same product.

---

## 7. Notifications & continuity: one conversation

- **Server-owned state.** Inbox, read-state, per-topic × per-channel preferences, and quiet hours live behind `/api/v1/notifications/*` and the outbox — so a notification read on mobile is read on web, and preferences set anywhere apply everywhere.
- **Channels by surface:** push is mobile's edge (APNs/FCM via Expo); email + in-app inbox are shared; web reads the same inbox.
- **Reconcile local reminders (target):** mobile's on-device saved-event reminders should converge on the server outbox so reminders survive reinstall and don't double-fire with server sends (audit P3).
- **One preference center:** the same topic/channel matrix is editable on web and mobile and stored once.

---

## 8. Analytics: one event catalog

- A **single typed event catalog** ([`docs/specs/EVENTS/analytics.md`](./specs/EVENTS/analytics.md)) defines event names and properties used **identically** on web and mobile, so funnels (discover → save → follow → submit → check-in) are comparable across surfaces and a journey that crosses devices is still one funnel.
- Cross-surface attribution uses the **shared user id** from the session, not per-device ids, so device switches don't fragment the journey.

---

## 9. Division of labor (who owns what)

| Job                                                       | Primary surface | Why                                     |
| --------------------------------------------------------- | --------------- | --------------------------------------- |
| SEO / long-tail discovery, landing pages, `llms.txt`      | **Web**         | Search visibility, shareable city pages |
| Member recall: push, saved, "this week", fast return      | **Mobile**      | Installed presence, notifications       |
| Organizer/Host management (deep: bulk, analytics)         | **Web**         | Large screen, multi-pane editing        |
| Organizer/Host quick actions (edit, post, moderate-state) | **Mobile**      | On-the-go                               |
| **Ambassador field work** (check-in, photo, fast-track)   | **Mobile**      | Inherently in-the-field                 |
| Admin / Ops / Pipeline / Moderation                       | **Web**         | Dense back-office; hand-off from app    |

Neither surface is "the lite version" of the other — each is **best-fit for its job**, drawing from the same data and identity.

---

## 10. Governance — how we keep them in sync

These rules make integration durable rather than a one-time effort:

1. **Spec parity.** Every PRD/TDD states behavior for **both** web and mobile (or explicitly delegates one surface, e.g. "admin: web-only, app hands off"). A spec that silently covers one surface is incomplete.
2. **Contract-first.** No mobile feature ships against an endpoint that isn't in `packages/shared`. Drift fails CI.
3. **No orphan surface.** A destination is native on the surface it fits and an authenticated hand-off everywhere else — never a dead-end or a forced re-login.
4. **One identity, one role model, one preference center, one analytics catalog.** Enumerated above; changes go to the shared source, not a per-surface copy.
5. **Definition-of-Done parity check.** A feature is "done" only when its cross-surface behavior (native or hand-off) is verified — added to the existing DoD in `MOBILE_APP_STRATEGY.md §3.5`.
6. **Tokens from one place (target).** Brand changes flow from shared tokens to both surfaces.

---

**Bottom line:** Web and mobile already share the one thing that matters most — a single backend, contract, and identity. Deep integration is finishing the rest: drive **both** UIs from the same `RoleAssignment` scopes, make **every URL resolve on both surfaces** (native or authenticated hand-off), unify **tokens, notifications, and analytics**, and enforce **spec parity** so neither surface drifts again. Do that, and IndLokal stops being "a website and an app" and becomes one product a user can pick up on any screen.
