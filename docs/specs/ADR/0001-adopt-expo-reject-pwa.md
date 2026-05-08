# ADR-0001: Adopt Expo (React Native) + Monorepo; Reject PWA as primary

- **Date:** 2026-04-22
- **Status:** Accepted
- **Related:** [ADR-0002](0002-zod-as-contract.md), [`docs/MOBILE_APP_STRATEGY.md`](../../MOBILE_APP_STRATEGY.md)

## Context

The IndLokal web app (Next.js + Prisma/Postgres) is in active development and pre-launch. It is being built as a discovery surface, but web alone behaves like most web products do for a diaspora audience: high one-shot intent, low return-visit habit. Our growth thesis depends on turning sporadic visitors into a weekly habit around Indian events and communities in their city, and that requires reliable push, store presence, OS-level integrations, and an installed icon people trust.

The team is small, TypeScript- and React-fluent, and already operates the Next.js codebase. Any client architecture we pick must be sustainable at this team size and must not fork the domain logic that lives in `apps/web/src/modules/*` and shared contracts in `packages/shared`.

## Decision

Build native iOS and Android apps using **Expo (React Native) + EAS**, organized in a **pnpm + Turborepo monorepo** alongside the existing Next.js app. Web and mobile share a single backend and a single contract:

- `apps/web` — current Next.js app (unchanged delivery model).
- `apps/mobile` — Expo app.
- `packages/shared` — Zod schemas, generated typed client, analytics and notification catalogs.
- Backend is the existing Next.js stack, exposed under versioned `/api/v1/*` (per [ADR-0002](0002-zod-as-contract.md)).

A PWA is **explicitly rejected** as the primary mobile delivery channel.

## Strategic rationale

This is a product-positioning decision before it is a tooling decision. The roles of our surfaces are:

- **Mobile is the retention surface.** It owns DAU/MAU, push opt-in, D30/D90, saved-event reminders, and the weekly digest loop. Habit formation happens here.
- **Web is the acquisition and operations surface.** It owns SEO long-tail ("Indian events {city}", "Diwali near me"), shareable OG cards, the organizer/admin console, and the editorial and moderation pipeline. Web is the funnel and the back office.
- **Push, deep links, share sheet, calendar, widgets, and (later) Live Activities are core product capabilities.** They are not enhancements layered on top of a content site; they are how the retention loops in [`MOBILE_APP_STRATEGY.md`](../../MOBILE_APP_STRATEGY.md) §5 and §7 actually work. A PWA cannot deliver them at the quality the product depends on, especially on iOS — which dominates the segments we target.
- **One backend, two clients.** The Next.js API is the single source of truth; web and mobile are thin clients over a shared Zod contract. This keeps the team small without splitting domain logic across stacks.

## Consequences

**Positive**

- One TypeScript codebase per OS pair instead of two (Swift + Kotlin).
- OTA updates via EAS Update for JS-only changes; native binaries on a predictable cadence.
- Shared Zod contracts eliminate web/mobile drift.
- Full APNs/FCM, store presence and ASO, and deep OS integrations.

**Negative**

- Native binary releases run on a 2-week rhythm, with App Store and Play Store review risk on each.
- Two stores to support (listings, screenshots, localizations, compliance).
- EAS spend grows with the team and build volume.

**Neutral**

- Monorepo tooling overhead, mitigated by Turborepo + pnpm and standard CI patterns.
- Expo's managed boundaries occasionally require config plugins for native modules; acceptable at our scope.

## Alternatives considered

- **PWA only.** Cheapest to ship, but iOS Web Push is second-class, there is no store presence, OS integrations are weak, and an installed app icon is a meaningful trust signal for the diaspora audience we serve. Rejected as the primary surface; may still play a role as a fallback in unsupported regions.
- **Native Swift + Kotlin.** Highest UX ceiling, but roughly 2× the cost and splits a small team across three codebases (web, iOS, Android). Premature given current scale.
- **Flutter.** Strong runtime, but no shared types with the existing TS/Zod/Next.js stack and a steep ramp for the current team. The contract-sharing benefit alone makes Expo the better fit.

## Non-goals

To prevent scope drift in future debates, this decision is explicitly **not** optimizing for:

- **Lowest-cost distribution.** App Store and Play Store overhead, EAS spend, and a 2-week native cadence are accepted costs of the retention surface we want.
- **Universal device coverage in v1.** KaiOS, Android Go, and embedded browsers are out of scope. iOS 16+ and Android 10+ are the supported floor.
- **Pixel-for-pixel parity with web.** Mobile follows native conventions (sheets, tabs, native share, OS prompts) even where they diverge from the web layout.
- **A standalone backend for mobile.** No mobile-only services, no separate auth provider, no GraphQL gateway. Everything routes through the existing Next.js stack.
- **Replacing web.** Web continues to be invested in for SEO, organizer tooling, and editorial workflows. It is not in maintenance mode.

We are optimizing for **engagement, trust, and growth loops**, measured against the targets in [`MOBILE_APP_STRATEGY.md`](../../MOBILE_APP_STRATEGY.md) §1.

## Future extensions

The architecture is set up to absorb roadmap items from [`docs/AI_AGENT_PRODUCT.md`](../../AI_AGENT_PRODUCT.md), [`docs/AI_AGENT_ARCHITECTURE.md`](../../AI_AGENT_ARCHITECTURE.md), and `MOBILE_APP_STRATEGY.md` §10 without re-platforming:

- **Personalization engine.** `modules/scoring` already emits per-entity scores read by mobile via `/api/v1/discovery/*`. Adding a per-user `personalScore` is a new field plus a feed-rank flag, not a new system.
- **Recommendation system.** Collaborative filtering on `UserInteraction`, `SavedEvent`, and `SavedCommunity` plugs into the same Discover feed and into notification gating ([TDD-0002](../TDD/0002-devices-and-notifications.md)). Recommendations become another producer on the notification outbox.
- **AI assistant / agent layer.** Exposed as `/api/v1/agent/*` backed by the existing modules; mobile gets a chat or suggestion entry point with no contract change. Tool-calling reuses the Zod schemas in `packages/shared` directly as agent tool definitions.
- **Organizer mobile surface.** The existing `claimedBy` / `COMMUNITY_ADMIN` role plus the outbox let us add an organizer tab in Phase 2 with no backend churn.
- **Live Activities, widgets, geofenced "events near you", WhatsApp Business channel.** All expressible as additional outbox channels or additional consumers of the same content APIs.

If any of these later require a contract break, it is handled per [ADR-0002](0002-zod-as-contract.md) (new `/api/vN/`), not by revisiting the client architecture chosen here.
