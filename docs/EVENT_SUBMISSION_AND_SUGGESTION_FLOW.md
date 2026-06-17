# Event Submission and Suggestion Flow

**Part of:** [Submission and Suggestion Flows: Unified Policy](./SUBMISSION_AND_SUGGESTION_FLOWS.md)  
**Related specs:** PRD/TDD-0057 (unified suggestion intake), PRD/TDD-0037 (event governance), [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md)

---

## 1. Overview

IndLokal accepts event listings through two flows:

| Flow                               | Precondition                      | Use Case                                                      |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| **Organizer event submission**     | User is registered organizer/host | Organizer creates and manages an event in their workspace     |
| **Event suggestion**               | Any user (auth or anon)           | Community member tips the platform about a missing event      |
| **Host event submission** (future) | Independent event host            | Non-organizer creates a ticketed event, queued for moderation |

All flows result in **moderation-gated publication**. An event moves from PENDING_REVIEW → PUBLISHED only after operator/organizer approval, or automatically if sourced from a trusted organizer.

---

## 2. Design Principles

### 2.1 Organizer authority + community discovery

Organizers (e.g., community leaders) create events in their workspace and they publish immediately if within their authority. Community members can tip the platform about missing events—the platform vets before publication.

### 2.2 Minimal event profile at creation

Form collects basics: title, date/time, location, category. Organizers refine via dashboard post-approval.

### 2.3 Trust-based moderation

**Organizer-created** events auto-publish if organizer is verified/trusted.  
**Host-submitted** events (no organizer status) queue for admin approval before PUBLISHED.  
**Community-suggested** events queue for admin approval + event moderation rules before PUBLISHED.

### 2.4 Temporal scoping

Events have clear start/end times. Expired events are archived, not deleted. Duplicate detection is smarter than communities—same event name is OK if dates differ.

---

## 3. Entry Points

### 3.1 Organizer event submission

Organizers reach the creation form from:

1. **Organizer workspace** — `GET /organizer/events/new` (authenticated, organizer-only)
2. **Organizer dashboard** — "+ Create Event" button on events list

### 3.2 Community event suggestion

Members and guests reach the suggestion form from:

1. **Contribute hub** — `GET /contribute?type=event` or `GET /[city]/contribute?type=event` (auth optional)
2. **City events page** — "Is there an event we're missing?" callout (future)
3. **Direct URL** — `/contribute?type=event` or `/[city]/contribute?type=event`

**Naming convention:** Public UI, routes, app-layer services, analytics, and queue labels use **Contribute**. `SUGGEST_EVENT` and `EVENT_SUGGESTION` are legacy storage/API identifiers and should not leak into UI or new service names.

---

## 4. Organizer Event Submission Flow

### Step 1 — Form Completion

**Route:** `GET /organizer/events/new`  
**Page:** Server component (`src/app/organizer/events/new/page.tsx`) that fetches:

- Organizer's communities and categories
- Current city(s) where organizer operates

**Client form** (`EventSubmissionForm.tsx`) collects:

#### Section A — Event Details

| Field             | Required | Validation                                                                     |
| ----------------- | -------- | ------------------------------------------------------------------------------ |
| Title             | Yes      | 5-200 chars                                                                    |
| Start date/time   | Yes      | ISO 8601, in future (configurable buffer)                                      |
| End date/time     | Yes      | After start; duration ≤ 7 days (configurable)                                  |
| Location (search) | Yes      | City + venue lookup via maps API                                               |
| Short description | Yes      | 10–1000 chars                                                                  |
| Category          | Yes      | dropdown (e.g., Social, Professional, Cultural, Sports, Food & Beverage, etc.) |

#### Section B — Association

| Field                           | Required | Notes                                                                                             |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Associated community (optional) | No       | Organizer can link to a community they manage; pre-populates if coming from community detail page |

#### Section C — Access

| Field                         | Required | Notes                                                                   |
| ----------------------------- | -------- | ----------------------------------------------------------------------- |
| Registration link / Join link | No       | Optional URL (RSVP, ticket sales, event page)                           |
| External event ID             | No       | Ticketing system ID (Eventbrite, Meetup, etc.)—helps dedup on ingestion |

#### Section D — Reach

| Field            | Required | Notes                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------- |
| Publicly listed? | Yes      | Toggle: yes (discoverable in city calendar) \| no (hidden, link-only) |

### Step 2 — Server Action

`createOrganizerEvent()` in `src/app/organizer/events/actions.ts`:

1. Validate form via Zod schema
2. Verify organizer owns the associated community (if provided)
3. Create `Event` row:
   - `organizerId: currentUserId`
   - `title, startAt, endAt, location, description, category, communityId (optional), externalEventId (optional)`
   - `moderationState: PUBLISHED` (organizer-trusted events publish immediately)
   - `source: ORGANIZER_CREATED`
   - `metadata.createdBy: { userId, email, timestamp }`
   - `isPubliclyListed: true/false` per organizer choice
4. Create `EventAccessChannel` row (registration link if provided)
5. Emit `EVENT_CREATED` analytics event
6. Revalidate organizer dashboard + city events route

**Result:** Event is live on the city calendar if `isPubliclyListed=true`. Organizer sees confirmation: "Event live on IndLokal. [Edit]" button.

### Step 3 — Post-Creation

Organizer can edit/delete the event via their workspace until it is expired. After expiration, event moves to archive state and is read-only.

---

## 5. Community Event Suggestion Flow

### Step 1 — Form Completion

**Route:** `GET /contribute?type=event` or `GET /[city]/contribute?type=event`  
**Page:** Client form (or modal, depending on UX) that collects:

| Field                     | Required    | Notes                                     |
| ------------------------- | ----------- | ----------------------------------------- |
| Event title               | Yes         | 5-200 chars                               |
| Date                      | Yes         | ISO date in future                        |
| Time (optional start/end) | No          | If omitted, interpreted as all-day or TBD |
| Venue / location          | No          | Freetext or map lookup                    |
| Category                  | No          | Dropdown (see organizer form options)     |
| Additional details        | No          | 0–500 chars (tip for ops/organizer)       |
| Your name (if auth)       | Auto-filled | Authenticated users auto-identified       |
| Your email                | Optional    | For follow-up if approved                 |
| Contact preference        | Optional    | "Notify me when this event is listed"     |

### Step 2 — Server Action

`contributeEvent()` in `src/app/actions/events.ts`:

1. Validate form via Zod schema
2. Classify trust lane:
   - **Authenticated user with history** (≥3 prior suggestions, ≥1 approved) → IDENTIFIED_CONTRIBUTOR
   - **Authenticated user** → IDENTIFIED_CONTRIBUTOR
   - **Anonymous/light auth** → PUBLIC_UNTRUSTED
3. Run dedup check:
   - Query events in city with similar title (bigram ≥ 0.7)
   - Query events in date range ±1 day at venue (if venue provided)
   - If strong match found: flag for dedup merge consideration (do not block submission)
4. Create `ContentReport` row:
   - `reportType: SUGGEST_EVENT`
   - `entityType: EVENT`
   - `sourceType: COMMUNITY_SUGGESTION`
   - `metadata: { title, date, venue, category, details, suggestorEmail, trustLane, dupesFound? }`
5. Create `PipelineItem`:
   - `entityType: EVENT`
   - `sourceType: EVENT_SUGGESTION`
   - `city, suggestedData: { title, date, venue, category, details }`
   - `confidence: 0.6` (typical for community suggestion)
   - `status: PENDING_REVIEW`
6. Emit `CONTRIBUTION_SUBMITTED` analytics event (eventType=EVENT, trustLane=...)
7. Send confirmation email: "Thanks! We'll review and add to the calendar if it's a fit. We review within 72 hours."

### Step 3 — Admin/Ops Review

**Route:** `GET /admin/pipeline?entityType=EVENT`  
**View:** Pipeline review queue showing:

- Suggested event title, date, venue
- Submitter name and trust lane badge
- Confidence score
- Any dedup warnings

**Actions:**

#### Approve

`approveEventSuggestion(pipelineItemId)`:

1. Extract `suggestedData` from PipelineItem
2. Create `Event` row:
   - `title, startAt, endAt, location, description, category` (from suggestion)
   - `organizerId: null` (no organizer—published as platform-discovered)
   - `moderationState: PUBLISHED`
   - `source: PLATFORM_SUGGESTION`
   - `metadata.suggestedBy: { email?, trustLane }`
   - `isPubliclyListed: true`
3. Create `TrustSignal` with `signalType: ADMIN_VERIFIED`
4. Optionally create `EventAccessChannel` if external link extracted from metadata
5. Set `PipelineItem.status: RESOLVED` + `PipelineItem.resolvedAt: now`
6. Send email to suggester (if email captured): "Your event tip was added! [View on IndLokal]"
7. Revalidate city events route

#### Reject

`rejectEventSuggestion(pipelineItemId, reason)` with EventRejectionReason:

1. Set `PipelineItem.status: REJECTED` + `PipelineItem.rejectionReason: reason`
2. Set `Event.moderationState: REJECTED` + `Event.rejectionReason: reason` (NEW)
   - Reasons: POLICY_VIOLATION (organizer violation) \| UNVERIFIABLE (suggestion unverifiable) \| DUPLICATE \| SPAM \| OUTSIDE_COVERAGE
3. Send optional email to suggester (if email captured and policy allows)
4. Revalidate pipeline queue

Event remains in DB in REJECTED state; operators can later view rejection reason if approving similar future suggestion.

#### Merge with Existing Event

`mergeEventSuggestion(pipelineItemId, existingEventId)`:

1. Link `PipelineItem` to existing `existingEventId` as a duplicate source
2. Update existing event's `metadata.suggestedDuplicates` with new data points (if conflicting details found)
3. Set `PipelineItem.status: RESOLVED_DUPLICATE`
4. Emit analytics: `SUGGESTION_MERGED_WITH_EXISTING`

#### Escalate to Host/Organizer

`escalateEventSuggestion(pipelineItemId, targetOrganizerId)`:

1. Send invitation to organizer: "A community member suggested an event your [community] might be hosting. [Review & claim]"
2. Create invitation token + link
3. Set `PipelineItem.status: ESCALATED_TO_ORGANIZER`

---

## 6. Host Event Submission Flow (Future)

**Note:** This flow is not yet implemented. Placeholder for reference.

A non-organizer event host (e.g., ticketing partner, external calendar) can submit an event for platform review. The event queues for admin moderation before PUBLISHED state.

**Expected behavior:**

- Event submitter provides full profile (name, email, organization, terms acceptance)
- Event created with `moderationState: PENDING_REVIEW`
- Event queued in admin review for trust/dedup check
- On approval: `moderationState: PUBLISHED` + organizer invited to claim authority
- On rejection: event remains REJECTED in DB (not visible to public)

---

## 7. Data Model

### Events Table

| Field                    | Type     | Notes                                                                                                                                        |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | UUID     | Primary key                                                                                                                                  |
| `title`                  | String   | Event name                                                                                                                                   |
| `startAt`                | DateTime | UTC                                                                                                                                          |
| `endAt`                  | DateTime | UTC; end ≥ start                                                                                                                             |
| `location`               | String   | Venue/address (freetext or structured)                                                                                                       |
| `description`            | String   | Rich text or markdown                                                                                                                        |
| `category`               | Enum     | SOCIAL, PROFESSIONAL, CULTURAL, SPORTS, FOOD_BEVERAGE, OTHER                                                                                 |
| `organizerId`            | UUID     | Foreign key to User (null if community-suggested + platform-published)                                                                       |
| `communityId`            | UUID     | Optional foreign key; if provided, event is "by" or "for" this community                                                                     |
| `moderationState`        | Enum     | PUBLISHED \| PENDING_REVIEW \| REJECTED                                                                                                      |
| `rejectionReason`        | Enum     | (NEW) POLICY_VIOLATION \| UNVERIFIABLE \| DUPLICATE \| SPAM \| OUTSIDE_COVERAGE \| NULL. Populated when moderationState = REJECTED.          |
| `source`                 | Enum     | ORGANIZER_CREATED \| PLATFORM_SUGGESTION \| EXTERNAL_CALENDAR \| OTHER                                                                       |
| `isPubliclyListed`       | Boolean  | true = discoverable; false = link-only                                                                                                       |
| `externalEventId`        | String   | Ticketing system ID (for dedup)                                                                                                              |
| `confidence`             | Float    | (NEW) 0–1 score indicating operator trust (VERIFIED 0.95, STRONG 0.80, MODERATE 0.60, LOW 0.40, UNCONFIRMED 0.20). Used for admin filtering. |
| `metadata`               | JSON     | { createdBy?, suggestedBy?, reviews?, tags?, ... }                                                                                           |
| `createdAt`, `updatedAt` | DateTime | Timestamps                                                                                                                                   |

### Event Access Channels

| Field         | Type    | Notes                                                          |
| ------------- | ------- | -------------------------------------------------------------- |
| `id`          | UUID    | Primary key                                                    |
| `eventId`     | UUID    | Foreign key to Event                                           |
| `channelType` | Enum    | WEBSITE \| RSVP \| TICKETING \| FACEBOOK \| INSTAGRAM \| OTHER |
| `url`         | String  | Access URL                                                     |
| `isPrimary`   | Boolean | true for main RSVP/ticketing link                              |

### Pipeline Items (Event suggestions)

| Field                                   | Type     | Notes                                                                                  |
| --------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `id`                                    | UUID     | Primary key                                                                            |
| `entityType`                            | Enum     | EVENT                                                                                  |
| `sourceType`                            | Enum     | EVENT_SUGGESTION                                                                       |
| `city`                                  | String   | City slug                                                                              |
| `suggestedData`                         | JSON     | { title, date, venue, category, details, ... }                                         |
| `confidence`                            | Float    | 0–1; confidence of extraction/dedup                                                    |
| `status`                                | Enum     | PENDING_REVIEW \| RESOLVED \| REJECTED \| RESOLVED_DUPLICATE \| ESCALATED_TO_ORGANIZER |
| `resolvedEventId`                       | UUID     | Foreign key to Event (populated on approval/merge)                                     |
| `rejectionReason`                       | String   | Reason for rejection (if any)                                                          |
| `createdAt`, `reviewedAt`, `resolvedAt` | DateTime | Timestamps                                                                             |

---

## 8. Deduplication logic

Event dedup is more sophisticated than communities because events are **temporal**.

### Exact matches

**Rule:** Same title + same date/time at same venue → hard merge candidate.

**Algorithm:**

```
For each suggestion:
  Title bigram ≥ 0.9 (nearly exact)
  Venue similarity ≥ 0.8 (fuzzy match)
  Date ∈ [suggestion.date - 1 day, suggestion.date + 1 day]
  → Flag for merge or reject as duplicate
```

### Soft matches

**Rule:** Similar title + same venue + dates ±2 days → escalate to operator for review.

**Algorithm:**

```
Title bigram ≥ 0.7 (similar)
Venue match ≥ 0.6
Date ∈ [suggestion.date - 2 days, suggestion.date + 2 days]
→ Alert operator: "Possible duplicate or recurring event"
```

### No match

**Rule:** No existing event matches criteria → approve as new event.

---

## 9. Status lifecycle

### Organizer event

```
[Form submitted]
      ↓
  PUBLISHED (live immediately, organizer trusted)
      ↓
  EXPIRED (after end time + grace period)
```

Organizers can delete pre-publication; post-publication events are archived, not deleted.

### Community suggested event

```
[Suggestion submitted]
      ↓
  PENDING_REVIEW (in admin queue)
      ├─ PUBLISHED (approved for discovery)
      ├─ REJECTED (not a fit)
      └─ RESOLVED_DUPLICATE (merged with existing event)
```

---

## 10. Transparency and Communication

**Organizer (event creation):**

- Immediate: "Event live on IndLokal."
- Edit: In-app dashboard; no re-review required

**Community suggester (event suggestion):**

- Immediate: "Thanks! We'll review within 72 hours."
- Approved: "Your event tip was added! [Link]"
- Rejected: "We couldn't add this event. [Reason: outside coverage area | too far in future | duplicate | etc.]"
- Merged: "This event matches one already on IndLokal."

---

## 11. Analytics and observability

**Key events:**

- `EVENT_CREATED` — organizer creates event
- `EVENT_CONTRIBUTION_SUBMITTED` — community contributes an event tip
- `EVENT_SUGGESTION_APPROVED` — admin approves suggestion
- `EVENT_SUGGESTION_REJECTED` — admin rejects suggestion
- `EVENT_SUGGESTION_MERGED` — suggestion merged with existing event
- `EVENT_EXPIRED` — event moved to archive

**Canonical properties:**

- `eventId`, `organizerId`, `eventTitle`
- `sourceType` (ORGANIZER_CREATED vs PLATFORM_SUGGESTION)
- `trustLane` (for suggestions)
- `moderationState`
- `isPubliclyListed`
- `reviewLatencySeconds` (time from suggestion to approval/rejection)

**Dashboards:**

- Events created per week, by city and organizer
- Suggestion approval rate by trust lane
- Duplicate suppression rate
- Time-to-review SLA tracking

---

## 12. Routes and Files Reference

| Route                                  | File                                          | Purpose                                                                               |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /organizer/events/new`            | `src/app/organizer/events/new/page.tsx`       | Organizer event creation form                                                         |
| Server action                          | `src/app/organizer/events/actions.ts`         | `createOrganizerEvent()`                                                              |
| `GET /contribute?type=event`           | `src/app/contribute/page.tsx`                 | Global event contribution form; user selects city                                     |
| `GET /[city]/contribute?type=event`    | `src/app/[city]/contribute/page.tsx`          | City-scoped event contribution form                                                   |
| Server action                          | `src/app/actions/events.ts`                   | `contributeEvent()`                                                                   |
| `GET /admin/pipeline?entityType=EVENT` | `src/app/admin/(dashboard)/pipeline/page.tsx` | Event suggestion review queue                                                         |
| Server actions                         | `src/app/admin/(dashboard)/actions.ts`        | `approveEventSuggestion()`, `rejectEventSuggestion()`, `mergeEventSuggestion()`, etc. |
| Validation schemas                     | `src/lib/validation.ts`                       | `createOrganizerEventSchema`, `contributeEventSchema`                                 |

---

## 13. Non-Goals (MVP)

- Image/banner upload at creation (organizers can edit in dashboard)
- Advanced recurring event support (one-off events only at MVP; recurrence is future)
- Integration with external calendar feeds (calendar ingestion is separate pipeline)
- Attendee/RSVP tracking (out of scope for initial launch)
- Ticketing integration (external ticketing links only; no 1st-party sales)

---

## 14. Future Enhancements

- **Organizer suggestions for events:** "I see an event at my venue—tag the organizer to claim it"
- **Recurring events support:** Option to define recurrence rule (weekly, bi-weekly, etc.); generates child events
- **Calendar feed ingestion:** Admin can subscribe to external calendars (Eventbrite, Meetup, Google Calendar) for auto-import
- **Attendee anonymized insights:** Organizers see aggregate event discovery stats (impressions, clicks) without PII
- **Event series / seasons:** Bundle related events under a season or series header
- **Advanced venue management:** Organizers can link multiple events to a managed venue record, with venue analytics
- **Published → Draft transitions:** Allow organizers to un-publish events (move to PENDING_REVIEW) for editing without losing history
