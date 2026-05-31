# Events: Model, Lifecycle & Governance (Product Blueprint)

## 1. Purpose and Scope

This document defines **what an event is on IndLokal, how it comes into being, who is
allowed to publish it, and the states it moves through** over its life. It is the
foundational product blueprint for the event graph — the retention engine of the
product.

It covers:

- The kinds of events that exist and where each one comes from
- The two orthogonal axes every event lives on: **moderation** and **lifecycle**
- Who can create, publish, edit, and moderate events (the governance lanes)
- The rules that keep the event feed trustworthy without slowing real organizers down
- How the event model is shaped so **future event organizers** slot in without a rewrite

It does **not** describe code internals, database column types, or migration mechanics.
It is a product operating blueprint. For where today's product diverges from it, see
[EVENTS_AUDIT.md](./EVENTS_AUDIT.md). For the authority model events build on, see
[RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md). Implementation is specced in
[docs/specs/PRD/0037-event-governance-and-approval-model.md](./specs/PRD/0037-event-governance-and-approval-model.md)
and its TDD.

---

## 2. Why This Blueprint Exists

Events are the reason a newcomer opens IndLokal twice. Communities are the directory;
events are the heartbeat. If the event feed is stale, wrong, or full of unvetted noise,
the product fails its core promise. If publishing an event is slow or gated behind a
platform queue, real organizers leave.

Today event creation grew organically across three different entry points — the
community organizer workspace, the independent event-host flow, and the public/ambassador
submission queue — each with its own rules and, worse, its own **contradictory
messaging** (a page says "pending review" for an event that is already public). That
drift is a trust and correctness risk.

The single most important idea: **an event has two independent truths — whether it is
allowed to be seen (moderation), and where it is in time (lifecycle).** Conflating them
is the root of today's confusion. This blueprint separates them permanently.

---

## 3. The Kinds of Events

Every event has a **source** — where it came from — and that source determines its
governance lane. There are three families.

### 3.1 Community events

Created by the people who run a claimed community, from the organizer workspace. These
are **first-party, trusted** content: the organizer (or a collaborator they invited) is
accountable for them. They belong to a community and inherit its identity.

### 3.2 Host events

Created by an **independent event host** — a person who runs events but does not run a
community (a concert promoter, a freelance dance teacher). They have no community to
vouch for them, so their events are **vetted by the platform** before going public.

### 3.3 Discovered events

Brought in by the **content pipeline** (scraped/known calendar feeds) or **submitted by
the public or a city ambassador**. Nobody on the platform is accountable for them until a
reviewer approves, so they too are **vetted before going public**.

> A person can produce events in more than one family: the same user might run a claimed
> community (community events) and also post under their own name (host events). The event's
> source — not the person's profile — decides its lane.

---

## 4. Product Principles

1. **Two axes, never merged.** _Moderation_ (can it be seen?) and _lifecycle_ (has it
   happened?) are separate. A live event can be upcoming or past; a past event can still be
   pending review. Neither axis is ever derived from a trust badge.
2. **Trust the accountable, vet the anonymous.** If someone with community authority
   publishes an event, it goes live immediately. If nobody is accountable, the platform
   reviews it first.
3. **Status tells the truth.** Every label a user sees reflects the real state of the
   event. The product never shows "pending review" for content that is already public.
4. **The system decides visibility, not the screen.** Whether an event appears in the
   feed is enforced by the platform on every read, not by hiding a card.
5. **Least friction for real organizers.** The common, trusted case (a community
   publishing its own event) has zero platform bottleneck.
6. **Every moderation decision is recorded.** Who approved or rejected an event, when, and
   why is always answerable.
7. **One pattern, reused.** Event authority reuses the community authority pattern
   (organizer + collaborators), so future "event organizers" need no new mental model.

---

## 5. The Two Axes of an Event

### 5.1 Moderation state — _may this event be seen?_

| State              | Meaning                                                              | Public-visible |
| ------------------ | -------------------------------------------------------------------- | :------------: |
| **Published**      | Approved or trusted-on-create; part of the live feed.                |      Yes       |
| **Pending review** | Submitted by a non-accountable source; awaiting a platform decision. |       No       |
| **Rejected**       | A reviewer declined it; kept for the record and submitter feedback.  |       No       |

### 5.2 Lifecycle state — _where is this event in time?_

| State         | Meaning                                            |
| ------------- | -------------------------------------------------- |
| **Upcoming**  | Starts in the future.                              |
| **Ongoing**   | Currently happening (start passed, not yet ended). |
| **Past**      | Already finished.                                  |
| **Cancelled** | Called off by the organizer or platform.           |

These are **orthogonal**. A row is only shown publicly when it is `Published` **and** not
`Cancelled`. Lifecycle (`Upcoming/Ongoing/Past`) only orders and filters what is already
allowed to be seen.

> The current product approximates "needs review" using the presence of a trust signal.
> That is wrong on both axes and is the central defect this blueprint corrects.

---

## 6. Governance Lanes — Who Publishes, Who Vets

Every event enters through exactly one of two lanes, chosen by its source.

### 6.1 Community-trusted lane (publish on create)

- **Producers:** community organizer and their collaborators, from the organizer workspace.
- **Authority required:** edit authority over the active community (the community-role
  layer from [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md)).
- **Outcome:** event is `Published` immediately. No platform queue.
- **Why it's safe:** an accountable, known organizer stands behind it, and the platform
  team can deactivate any listing as a backstop.

### 6.2 Platform-review lane (vet before public)

- **Producers:** independent event hosts, public submitters, city ambassadors, and the
  content pipeline.
- **Authority required:** none beyond being signed in (or none at all for the pipeline);
  the gate is the **review**, not the creation.
- **Outcome:** event is `Pending review`; a platform reviewer moves it to `Published` or
  `Rejected`.
- **Why it's gated:** nobody on the platform is accountable for the content until a
  reviewer accepts it.

### 6.3 Policy matrix (v1)

| Producer                     | Can create | Goes live immediately | Needs platform review |
| ---------------------------- | :--------: | :-------------------: | :-------------------: |
| Community organizer          |    Yes     |          Yes          |          No           |
| Community collaborator       |    Yes     |          Yes          |          No           |
| Independent event host       |    Yes     |          No           |          Yes          |
| Public submitter             |    Yes     |          No           |          Yes          |
| City ambassador (fast-track) |    Yes     |          No           |   Yes (fast-track)    |
| Content pipeline             |    Yes     |          No           |          Yes          |
| Platform admin / ops         |    Yes     |          Yes          |   N/A (is reviewer)   |

> City-ambassador submissions are not auto-trusted, but they enter the review queue with
> higher confidence and priority — a fast lane, not a bypass.

---

## 7. What Each Actor Can Do With Events

| Capability                                  | Collaborator | Organizer | Event Host | City Ambassador | Platform (Admin/Ops) |
| ------------------------------------------- | :----------: | :-------: | :--------: | :-------------: | :------------------: |
| Create event for **their** community        |      ✓       |     ✓     |            |                 |          ✓           |
| Edit / cancel event for **their** community |      ✓       |     ✓     |            |                 |          ✓           |
| Publish a community event without review    |      ✓       |     ✓     |            |                 |          ✓           |
| Create a **host** event (no community)      |              |           |     ✓      |                 |          ✓           |
| Edit **their own** host event               |              |           |     ✓      |                 |          ✓           |
| Submit an event for review                  |              |           |     ✓      |  ✓ (own city)   |          ✓           |
| Approve / reject events in the review queue |              |           |            |                 |          ✓           |
| Cancel or take down any event (backstop)    |              |           |            |                 |          ✓           |

A host can only edit events they created. Editing material details of an **already-published**
host event (date, venue, title) re-enters the review lane — see §9.

---

## 8. Event Authority Model (and the Future Organizer)

Authority over an event mirrors authority over a community, so the product has **one
pattern** to reason about.

- **Community events** are governed by **community authority**. Anyone who can edit the
  community can manage its events. There is no separate "event role" to manage — it is
  inherited. This is the MVP and covers the majority of events.
- **Host events** are governed by **the host who created them**. For MVP the host is the
  single accountable person for their events; there is no co-host yet.

### 8.1 How an event is attributed

Every event answers "who is behind this?" through one of:

1. its **community** (for community events), or
2. the **person who created it** (for host events).

This attribution is a **first-class fact about the event**, not a label buried in
free-form metadata. It is what powers the "Hosted by…" / "Organised by…" block and what a
future event-organizer model will hang off.

### 8.2 The future: event organizers reusing the community pattern

The model is deliberately shaped so that when "event hosts/organizers" becomes a
first-class authority (see [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md) §12),
it reuses the same per-thing pattern as communities:

- one **event organizer** (the accountable person) per host event, plus
- optional **event collaborators** (co-hosts) — a people list on the event,

…exactly mirroring "one community organizer + collaborators." Until then, the single
creator **is** the organizer, and the event simply records who that is. No table or screen
needs to change its shape to add co-hosts later — only to grow a people list.

---

## 9. Governance Rules

These hold no matter which lane created the event:

1. **Visibility requires `Published`.** Nothing in `Pending review` or `Rejected` ever
   appears in public discovery, search, or feeds.
2. **Accountable → immediate; anonymous → reviewed.** The lane is decided by source, not
   by who is looking.
3. **Truthful status everywhere.** Organizer, host, admin, and public surfaces all render
   status from the event's real moderation + lifecycle state.
4. **Material edits to reviewed events re-enter review.** A host changing the date, venue,
   or title of a published event sends it back to `Pending review` (cosmetic edits do not).
   Community events, being trusted, do not.
5. **The platform is the backstop.** Any event can be cancelled or taken down by the
   platform team — always recorded.
6. **Every decision is logged.** Approvals, rejections (with reason), and takedowns are
   recorded with who, when, and why.
7. **Anti-flood guardrails stay.** A host has a cap on outstanding un-reviewed events so
   the queue can't be flooded; the cap lifts as their events are approved.

---

## 10. How an Event Becomes Public (at a glance)

| The event is…                        | …because                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- |
| **Published immediately**            | an organizer or collaborator created it for their claimed community         |
| **Published after review**           | a host/public/ambassador/pipeline event was approved by a platform reviewer |
| **Held back (Pending review)**       | a host/public/ambassador/pipeline event is awaiting a platform decision     |
| **Hidden (Rejected)**                | a reviewer declined it; the submitter is told why                           |
| **Removed (Cancelled / taken down)** | the organizer cancelled it, or the platform took it down as a safety action |

Each of these is enforced by the platform on every read — never by merely hiding a card.

---

## 11. Data & ER Alignment (conceptual)

This blueprint constrains the shape of the data without prescribing column types. The
event entity must carry, as first-class facts:

- **City** — required; the partition key for all discovery.
- **Community** — optional; present for community events, absent for host/pipeline events.
- **Creator (person)** — optional; the accountable individual for host events (and useful
  provenance for any human-created event). This replaces hiding the host id inside free-form
  metadata.
- **Source** — where it came from (community, host, public submission, ambassador, pipeline).
- **Moderation state** — Published / Pending review / Rejected (§5.1).
- **Lifecycle state** — Upcoming / Ongoing / Past / Cancelled (§5.2).
- **Review record** — who decided, when, and (on rejection) why.

**Start and end time.** Both `startsAt` and `endsAt` are required when a human creates
an event from an organizer flow (community or host), because a missing end time makes the
feed's "ongoing vs past" lifecycle ambiguous and weakens calendar/ICS export. The stored
column stays nullable so machine-ingested events (pipeline/calendar feeds) that genuinely
lack an end time are not rejected; the requirement is enforced at the form boundary, not
in the database.

Relationships, stated in plain terms:

```
City    1 ──< Event           (every event is in exactly one city)
Community 0/1 ──< Event       (an event may belong to a community)
User    0/1 ──< Event          (an event may have an accountable creator/host)
Event   1 ──< (future) EventCollaborator  (a people list, mirroring CommunityCollaborator)
```

The **future-organizer** requirement is satisfied by keeping creator attribution
first-class today and leaving room for an `EventCollaborator`-style people list later —
the same move communities already made. Nothing in the MVP shape blocks it; nothing in the
MVP builds it prematurely.

---

## 12. Non-Goals (this blueprint)

- Ticketing, payments, RSVP capacity, or waitlists.
- Per-field event permissions finer than "can edit this event."
- Event co-hosts / event-level people lists (planned later; will reuse the community pattern).
- A community-owner approval queue for collaborator-created events (possible later toggle).
- Reworking the pipeline's confidence/auto-approve thresholds (owned by the pipeline specs).

### 12.1 Considered and deferred: a separate `eventType` and `visibility`

Two additional event fields were evaluated and intentionally **not** added:

- **A coarse `eventType` enum** (e.g. `CULTURAL / RELIGIOUS / PROFESSIONAL / NETWORKING / …`).
  This duplicates the existing **topical `Category` taxonomy**, which already tags events
  with the same concepts (`cultural`, `religious`, `professional`, `networking-social`, …),
  and the one axis it would add on top — _community_ vs _business_ — is already served by
  the **business lens** (`BUSINESS_EVENT_CATEGORY_SLUGS`) plus the event `source`. Adding a
  parallel enum would create a second source of truth for "what kind of event" and a filter
  UX that overlaps the category filter. Revisit only if a product need appears that the
  category graph genuinely cannot express.
- **A `visibility` enum** (`PUBLIC / PRIVATE / INVITE_ONLY`). Every event today is public,
  and there is no invitation flow, access-control enforcement, or consumer that would read
  the field. Introducing it now would ship a column that is always `PUBLIC`. Defer until an
  invitation/private-event feature is actually designed, at which point the real access
  model — not a guessed three-value enum — should drive the shape.

---

## 13. Future Direction

- **Event organizers & co-hosts** — a first-class people list on host events, reusing the
  community organizer/collaborator pattern.
- **Optional community moderation** — let a community organizer require approval for
  collaborator-created events in sensitive communities.
- **Recurring-series governance** — manage a whole series (RRULE) as one reviewable unit.
- **Partner-org events** — events owned by an organization that owns several communities.
- **Reviewer SLAs & insights** — visible "pending since" timers and per-city review load.
