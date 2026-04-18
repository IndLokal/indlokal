# Analytics Guide — PostHog Implementation

> **Last updated:** 2025-04  
> **Stage:** MVP  
> **Owner:** Engineering team

---

## Purpose

PostHog is our primary product analytics tool. We use it to:

- Understand user journeys from discovery to conversion
- Measure activation and retention
- Identify drop-offs in key funnels
- Replay sessions to diagnose UX problems
- Make data-informed product decisions

We do **not** use PostHog for:

- Random click logging (autocapture handles exploration; custom events are for business intent)
- Marketing attribution (use Plausible or UTM-aware tooling for that)
- Backend monitoring or error alerting (use logging/APM for that)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Client (Browser)                                    │
│                                                      │
│  PostHogProvider  ─── posthog-js init (/ingest proxy)│
│  PostHogIdentify  ─── syncs session → posthog.identify│
│  PostHogPageView  ─── $pageview on route change      │
│                                                      │
│  Components use:                                     │
│    import { Events, useTrackEvent } from '@/lib/analytics' │
│    const track = useTrackEvent();                    │
│    track(Events.COMMUNITY_SAVED, { ... });           │
└──────────────────────┬──────────────────────────────┘
                       │  /ingest/* (reverse proxy)
                       ▼
              PostHog Cloud (EU)
                       ▲
                       │  posthog-node
┌──────────────────────┴──────────────────────────────┐
│  Server (API Routes / Server Actions)                │
│                                                      │
│  import { Events } from '@/lib/analytics/events'     │
│  import { captureServerEvent } from '@/lib/analytics/server'  │
│  await captureServerEvent(userId, Events.X, {...})   │
└─────────────────────────────────────────────────────┘
```

### Key Files

| File                                 | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `src/lib/analytics/events.ts`        | Canonical event names (shared client + server)       |
| `src/lib/analytics/hooks.ts`         | Client-side hooks: `useTrackEvent`, identity helpers |
| `src/lib/analytics/server.ts`        | Server-side PostHog client + `captureServerEvent()`  |
| `src/lib/analytics/index.ts`         | Barrel re-export for client consumers                |
| `src/components/PostHogProvider.tsx` | Client init, pageview tracking                       |
| `src/components/PostHogIdentify.tsx` | User identity sync (identify/reset)                  |
| `next.config.ts`                     | Reverse proxy rewrites (`/ingest/*`)                 |

### Environment Variables

| Variable                   | Required   | Description                                        |
| -------------------------- | ---------- | -------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | Yes (prod) | PostHog project API key                            |
| `NEXT_PUBLIC_POSTHOG_HOST` | No         | PostHog host (default: `https://eu.i.posthog.com`) |

When `NEXT_PUBLIC_POSTHOG_KEY` is unset, all tracking silently no-ops. This is the default for local dev and CI.

---

## Event Naming Convention

- **Format:** `snake_case`, all lowercase
- **Pattern:** `object_verb` or `object_state` (e.g., `community_submitted`, `community_viewed`)
- **Properties:** `snake_case` keys, primitive values (strings, numbers, booleans)
- **No PII in event names or properties** — no emails, no names, no IPs

### Examples

```
✅  community_viewed       { entity_id, entity_slug, city }
✅  search_performed       { query, city, results_count, has_results }
❌  Search Performed       ← wrong case
❌  user_clicked_button    ← too generic, not business-meaningful
❌  community_submitted    { email: 'user@...' }  ← PII leak
```

---

## Canonical Event List (MVP)

### Lifecycle Events

| Event            | Where                  | Properties      | KPI?        |
| ---------------- | ---------------------- | --------------- | ----------- |
| `user_signed_up` | Server: OAuth callback | `auth_provider` | ✅ Critical |
| `user_logged_in` | Server: OAuth callback | `auth_provider` | Exploratory |

### Engagement Events

| Event                      | Where                     | Properties                                                             | KPI?        |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------- | ----------- |
| `search_performed`         | Client: SearchTracker     | `query`, `city`, `results_count`, `has_results`                        | ✅ Critical |
| `community_viewed`         | Client: ViewTracker       | `entity_id`, `entity_slug`, `city`                                     | ✅ Critical |
| `event_viewed`             | Client: ViewTracker       | `entity_id`, `entity_slug`, `city`                                     | Exploratory |
| `community_access_clicked` | Client: AccessChannelLink | `community_id`, `community_slug`, `channel_type`, `city`, `is_primary` | ✅ Critical |
| `community_saved`          | Client: BookmarkButton    | `community_id`                                                         | Exploratory |
| `community_unsaved`        | Client: BookmarkButton    | `community_id`                                                         | Exploratory |

### Conversion Events

| Event                 | Where                 | Properties                     | KPI?        |
| --------------------- | --------------------- | ------------------------------ | ----------- |
| `community_submitted` | Server: submit action | `city`, `channel_types`        | ✅ Critical |
| `claim_submitted`     | Server: claim action  | `community_id`, `relationship` | ✅ Critical |

**Total: 10 events.** This is intentionally small. Resist the urge to add more until you have a clear product question that existing events can't answer.

---

## How to Add a New Event

1. **Ask: "What product decision will this event inform?"** If you can't answer clearly, don't add it.
2. Add the event name to `src/lib/analytics-events.ts` in the appropriate category
3. Fire it from the appropriate location:
   - **Client:** Use `useTrackEvent()` from `@/lib/analytics`
   - **Server:** Use `captureServerEvent()` from `@/lib/posthog` + import `Events` from `@/lib/analytics-events`
4. Add it to this documentation file
5. Verify in PostHog that the event appears with correct properties

### When NOT to Add a New Event

- "It might be useful someday" — autocapture already captures clicks/pageviews
- Duplicate of an existing event with slightly different properties
- UI micro-interactions (hover, scroll, focus) — use session replay instead
- Error tracking — use error monitoring tools, not analytics
- Events that only make sense with >10K users (we're not there yet)

---

## User Identity Rules

### Identify

- The `PostHogIdentify` component in the root layout reads the session cookie and calls `posthog.identify(userId)` on every page load
- Server-side events use the database `user.id` as `distinctId`
- This ensures client and server events are linked to the same user profile

### Reset

- When the user logs out, the `PostHogIdentify` component detects `userId` transitioning from set → null and calls `posthog.reset()`
- This prevents the next anonymous visitor on a shared device from being attributed to the previous user

### Anonymous Users

- Before login, PostHog assigns an anonymous `distinct_id` automatically
- After `posthog.identify()`, PostHog merges the anonymous and identified profiles
- For server-side events from unauthenticated users (e.g., `community_submitted`), use a non-PII placeholder like `'anonymous-submitter'`

---

## Privacy & PII Rules

1. **Never send emails, names, or phone numbers as event properties**
2. **Never use email as `distinctId`** — use database user IDs only
3. `maskAllInputs: true` is enabled for session recordings
4. PostHog is hosted on EU servers (`eu.i.posthog.com`)
5. When the PostHog key is unset, all tracking is disabled (safe for dev/CI)
6. The `/ingest` reverse proxy avoids exposing the PostHog domain to ad-blockers

---

## Autocapture & Session Recording

### Autocapture

Autocapture is **enabled by default** in posthog-js. This captures clicks, form submissions, and pageviews automatically. We use it for:

- Exploratory analysis (what are users clicking?)
- Discovering patterns before creating custom events
- Quick heatmap generation

We do **not** rely on autocapture for KPI measurement. All critical business events have explicit custom tracking.

### Session Recording

Session recording is enabled with `maskAllInputs: true`. Use it for:

- Debugging specific user issues
- Understanding navigation patterns
- Identifying UX friction points

---

## Dashboard & Funnel Readiness

### Recommended Dashboards

#### 1. Activation Funnel

```
$pageview (homepage) → search_performed → community_viewed → community_access_clicked
```

**Question:** What % of visitors find and engage with a community?

#### 2. Submission Funnel

```
$pageview (/submit) → community_submitted
```

**Question:** What % of submit page visitors complete a submission?

#### 3. Claim Funnel

```
community_viewed → claim_submitted
```

**Question:** What % of community page views lead to a claim?

#### 4. Search Effectiveness

- **Trend:** `search_performed` count over time
- **Breakdown:** `has_results = true` vs `has_results = false`
- **Question:** Are users finding what they're looking for?

#### 5. Top Engagement

- **Trend:** `community_viewed` + `community_access_clicked` over time
- **Breakdown by:** `city`, `channel_type`
- **Question:** Which communities and channels drive the most engagement?

### Session Replay Usage

- Set up a cohort for users who triggered `search_performed` with `has_results = false` — watch their sessions to understand what they were looking for
- Watch sessions of users who reached `community_viewed` but never clicked `community_access_clicked` — identify UX barriers

---

## Future Evolution (Defer Until Needed)

These improvements should wait until the product has more users and clearer needs:

| Improvement                                  | When to Add                                          |
| -------------------------------------------- | ---------------------------------------------------- |
| Feature flags for A/B testing                | When testing landing page variants or new features   |
| Group analytics (by city/community)          | When analyzing community-level metrics               |
| Backend-verified conversion events           | When submission/claim volumes justify the complexity |
| Custom person properties (preferences, role) | When segmentation becomes a product need             |
| Revenue/monetization events                  | When a business model is introduced                  |
| GTM integration                              | Likely never needed — keep analytics in code         |
| Data warehouse export                        | When building custom reporting or ML models          |
| Formal event schema validation               | When the team grows beyond 3-4 engineers             |

---

## Troubleshooting

**Events not appearing in PostHog:**

1. Check `NEXT_PUBLIC_POSTHOG_KEY` is set in `.env.local`
2. Check browser DevTools Network tab for `/ingest` requests
3. Verify the reverse proxy rewrites in `next.config.ts`
4. Check PostHog's Live Events view for real-time debugging

**User identity not linking:**

1. Verify `PostHogIdentify` is rendered in the root layout
2. Check that the session cookie (`lp_session`) exists after login
3. In PostHog, check the person profile for merged `distinct_id` values
