# Event Host Workspace (Product Blueprint)

## 1. Purpose and Scope

This document defines **what the event host workspace is, what an independent event
host can see and do there, and how that workspace stays trustworthy and useful** as the
host posts, edits, and tracks events over time. It is the product blueprint for the host
operating surface — the home an independent host lands on after signing in.

It covers:

- Who an event host is and how their workspace differs from a community organizer's
- The workspace surfaces a host gets (overview, events, profile) and why each exists
- The signals a host must always be able to read at a glance (what is live, what is
  waiting on review, what was declined, what is coming up)
- The rules that keep the host surface honest (truthful status, the review lane, the
  un-reviewed cap)
- How the host workspace deliberately mirrors the community organizer workspace so the
  product has **one operating pattern**, not two

It does **not** describe database column types, migration mechanics, or code internals.
It is a product operating blueprint. For the authority model events build on, see
[RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md). For the event moderation and
lifecycle axes the workspace renders, see [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md).
Implementation is specced in
[docs/specs/PRD/0038-event-host-workspace-dashboard.md](./specs/PRD/0038-event-host-workspace-dashboard.md)
and its TDD.

---

## 2. Why This Blueprint Exists

A community organizer who signs in lands on a **rich workspace**: a stats-aware overview,
quick actions, a profile-completeness meter, a channels panel, a team panel, and a direct
link to their public page. An independent event host who signs in lands on **two cards and
a warning banner**. The two roles run the same kind of content — events — through the same
review machinery, yet one gets a robust home and the other gets a stub.

That gap is a product problem, not just a cosmetic one. A host cannot see, at a glance,
**how many of their events are live, how many are waiting on review, or what was declined
and why.** They cannot edit the profile that renders as "Hosted by…" on every event detail
page without re-running the sign-up flow. They have no completeness nudge pushing them
toward a credible public presence. The result is a host who posts once and never returns —
the exact churn the event graph is supposed to prevent.

The single most important idea: **a host is an organizer of events, even without a
community, and deserves the same operating loop.** This blueprint gives the host workspace
the same shape as the community organizer workspace, reusing its patterns rather than
inventing a parallel one.

---

## 3. Who the Event Host Is

An **event host** is an independent person or small outfit who runs events but does **not**
run a claimed community — a concert promoter, a freelance dance teacher, a touring chef, a
meetup runner. They are defined in [RBAC_AND_AUTHORIZATION.md](./RBAC_AND_AUTHORIZATION.md)
and [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §3.2 as the producer of **host
events**: events with no community to vouch for them, which the platform therefore **vets
before they go public**.

A host has a lightweight **host profile** — a display name, a home city, and a few links
(website, Instagram, WhatsApp) — that powers the "Hosted by…" attribution block on their
public event pages. The profile is the host's identity on the platform; the events are
their output.

> A person can be both a community organizer and an event host. The two workspaces are
> separate doors (`/organizer` and `/organizer/host`) and the user's role decides which one
> they land in. This blueprint governs only the host door.

---

## 4. Product Principles

1. **One operating pattern, reused.** The host workspace mirrors the community organizer
   workspace — overview with stats, quick-action cards, a completeness meter, a profile
   surface, and a public-page link — so the product has a single mental model.
2. **Status tells the truth.** Every count and badge reflects the event's real moderation
   and lifecycle state (per [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §5). The
   workspace never shows "pending" for something already live, nor "live" for something in
   review.
3. **The review lane is visible, not hidden.** A host should always know how many events
   are awaiting review, how close they are to the un-reviewed cap, and which events were
   declined and why — the gate is explained, never silent.
4. **Least friction to a credible presence.** A completeness nudge guides the host toward a
   filled-out profile (name, city, links) because a credible "Hosted by…" block is what
   makes a host event worth approving and worth attending.
5. **A host governs only their own events.** The workspace shows and acts on events the
   host created — never another host's, never a community's. Authority is scoped to the
   creator, exactly as [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §8 requires.
6. **The system decides, not the screen.** What a host may edit or post is enforced on
   every action (creator check + un-reviewed cap), not merely by hiding a button.
7. **Shaped for the future organizer.** The workspace is built so that when host events
   grow co-hosts (event collaborators, [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md)
   §8.2), a "Team" surface slots in beside Events and Profile without a redesign.

---

## 5. The Host Workspace Surfaces

The workspace has three first-class surfaces, deliberately parallel to the organizer's
**Overview / Community Page / Events** rhythm.

### 5.1 Overview — _what is the state of my events?_

The landing surface. It answers, at a glance:

- **My events at a glance** — counts of events that are **live** (published & upcoming),
  **in review** (pending), **declined** (rejected), and **past**.
- **Review standing** — how many un-reviewed upcoming events the host has and how close
  they are to the cap, with a clear explanation when the cap is reached.
- **Next up** — the host's nearest upcoming event, so the workspace always has a focal
  point.
- **Needs attention** — events that were declined (with the reviewer's reason) so the host
  can fix and resubmit.
- **Quick actions** — post an event, view all events, edit profile.
- **Profile completeness** — a meter nudging the host toward a credible public identity.
- **Public presence** — a direct link to how the host appears publicly.

### 5.2 Events — _the full list I manage_

The complete, grouped list of the host's events (upcoming / past), each showing its true
status badge (Live / Pending review / Rejected / Cancelled), with create, view, and edit
actions. This surface already exists and is kept; the blueprint aligns its status
rendering and entry points with the overview.

### 5.3 Profile — _who I am publicly_

An editable surface for the host's display name, home city, and links — the same data the
sign-up flow collected, now maintainable without re-running sign-up. This is the host's
analogue of the organizer's **Community Page**, and it feeds the "Hosted by…" block and the
profile-completeness meter.

---

## 6. What the Host Can Do (at a glance)

| Capability                                    | Event Host | Platform (Admin/Ops) |
| --------------------------------------------- | :--------: | :------------------: |
| See an overview of **their own** events       |     ✓      |          ✓           |
| See live / in-review / declined / past counts |     ✓      |          ✓           |
| Read review standing and the un-reviewed cap  |     ✓      |          ✓           |
| Post a new event (enters the review lane)     |     ✓      |          ✓           |
| Edit / cancel **their own** event             |     ✓      |          ✓           |
| See the reason an event was declined          |     ✓      |          ✓           |
| Edit their host profile (name, city, links)   |     ✓      |          ✓           |
| Approve / reject events                       |            |          ✓           |

A host only ever sees and acts on events they created. Posting and the un-reviewed cap obey
the host lane defined in [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §6.2 and §9.

---

## 7. The Overview Signals (definitions)

So that counts mean the same thing everywhere, the overview is defined in terms of the two
event axes from [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §5, never from trust
badges:

| Signal              | Definition                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Live**            | `moderation = Published` **and** lifecycle `Upcoming`/`Ongoing` (not Cancelled).              |
| **In review**       | `moderation = Pending review`.                                                                |
| **Declined**        | `moderation = Rejected` (kept for the host to see the reason and resubmit).                   |
| **Past**            | lifecycle `Past` (regardless of moderation), shown dimmed for history.                        |
| **Un-reviewed cap** | count of `Pending review` **upcoming** events vs the host cap; posting is blocked at the cap. |

> The legacy dashboard counted "unverified" events by the **absence of a trust signal** and
> read host ownership from free-form metadata. Both are wrong per
> [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §5 and §11; the overview is defined on
> `moderationState` and the first-class `createdBy` creator instead.

---

## 8. Profile Completeness (definition)

The completeness meter mirrors the organizer's, adapted to what a host has:

| Item              | Done when…                               |
| ----------------- | ---------------------------------------- |
| Display name      | a public-facing name is set              |
| City              | a home city is set                       |
| At least one link | one website/social/chat link is set      |
| Two+ links        | a second link is set (stronger presence) |
| First event       | the host has created at least one event  |

The meter is a **nudge, never a gate** — a host can post with a minimal profile, but a
fuller profile makes the "Hosted by…" block more credible and their events more likely to
be approved and attended.

---

## 9. Governance Rules

These hold no matter how the workspace is reached:

1. **Creator-scoped visibility.** A host sees and acts only on events they created. The
   workspace never exposes another host's or a community's events.
2. **Truthful status everywhere.** Overview counts, list badges, and the event summary all
   render from the event's real moderation + lifecycle state.
3. **The cap is enforced server-side.** Reaching the un-reviewed cap blocks posting on the
   server, not merely by disabling a button; the workspace explains the cap and lifts it as
   events are reviewed.
4. **Profile edits are recorded.** Updating the host profile is an auditable, analytics-
   tracked action, consistent with the platform's "every meaningful change is recorded"
   principle.
5. **The platform is the backstop.** Any host event can be reviewed, rejected, or taken
   down by the platform team — the workspace surfaces those outcomes (e.g. a decline reason)
   rather than hiding them.

---

## 10. How the Host Workspace Mirrors the Organizer Workspace

| Organizer workspace surface       | Host workspace analogue                        |
| --------------------------------- | ---------------------------------------------- |
| Overview with quick-action cards  | Overview with quick-action cards               |
| Profile completeness meter        | Profile completeness meter (host-scoped items) |
| Community Page (editable profile) | Profile (editable host name / city / links)    |
| Events list with status badges    | Events list with status badges (kept, aligned) |
| Access channels panel             | Links panel (host links)                       |
| Team management                   | _Deferred_ — slot reserved for event co-hosts  |
| Public community page link        | Public "Hosted by…" presence link              |

Reusing the organizer pattern keeps the codebase honest: the shared
`OrganizerPageHeader`, card, and meter idioms are used as-is, and the host overview is built
from one workspace helper the way the organizer overview is.

---

## 11. Non-Goals (this blueprint)

- Event co-hosts / per-event people lists (deferred; will reuse the community organizer
  pattern per [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) §8.2).
- A separate host entity/table — the host profile stays a lightweight profile on the user
  until a richer host model is justified.
- Ticketing, RSVP capacity, payments, or attendee management.
- Changing the host review lane, the cap value, or the moderation axes (owned by
  [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md)).
- Multi-host organizations or transferring events between hosts.

---

## 12. Future Direction

- **Event co-hosts** — a "Team" surface on the workspace, reusing the community
  organizer/collaborator pattern, once host events become first-class people-bearing.
- **Engagement insights** — saves/views per event surfaced on the overview.
- **Resubmit-in-place** — turning a declined event's reason into a guided fix-and-resubmit
  flow directly from the overview.
- **Richer host profile** — logo/avatar and a public host page, graduating the profile from
  a lightweight block to a first-class surface.
