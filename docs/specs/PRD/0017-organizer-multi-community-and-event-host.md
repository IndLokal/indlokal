# PRD-0017: Multi-community ownership + event-only host flow

- **Status:** Draft
- **Owner:** JP (Founder)
- **Reviewers:** X (Partnerships), Y (Ops), Eng Lead
- **Linked:** PRD-0011 (organizer auth), PRD-0014 (RBAC),
  PRD-0009 (submit)

## 1. Problem

The organizer portal at `/organizer/*` (PRD-0011) was scaffolded around the
assumption "one organizer ↔ one community." The schema already allows
`User.claimedCommunities[]` (many), but the UI selects the first one and
hides the rest. Two real-world cases break:

1. **Multi-community organizers.** Several Stuttgart organisers run both
   a Tamil cultural community and a separate student-mentorship group; today
   they cannot toggle between them in the portal.
2. **Event-only hosts.** Independent organisers (e.g. classical concert
   promoters, freelance Bharatanatyam teachers) host events but do not run a
   community page. They have no first-class home — they currently submit via
   the public `/submit` form anonymously.

Both gaps push real organisers off the platform and starve the event graph.

## 2. Users & JTBD

- **Multi-community organizer (E3)** — wants a workspace switcher to manage
  several communities under one login.
- **Event host (E4)** — wants to claim and post their own events without
  pretending to be a community.
- **Y (Ops)** — wants both onboarding paths so cold outreach has a clear CTA.

## 3. Success Metrics

- ≥ 10 % of claimed communities are owned by users with ≥ 2 claimed
  communities by month 3 (i.e. multi-org workspace is used).
- ≥ 20 active event hosts (no community claim, ≥ 1 published event in
  rolling 60 d) by month 3.
- Median time from event-host signup → first published event < 24 h.
- Analytics: `organizer.workspace.switched`, `event_host.signup`,
  `event_host.event.published`.

## 4. Scope

### 4.1 Multi-community workspace switcher

- Add `currentCommunityId` to organizer session cookie.
- `/organizer` lists every claimed community in a sidebar; clicking switches
  context for the entire portal (edit, events, channels, verify, analytics).
- New route `/organizer/communities` — overview of all claimed communities
  with last-activity, completeness score, quick stats.
- `claim` flow already creates a `Community.claimedByUserId` link; ensure the
  same user can claim N more without UI breaking.

### 4.2 Event Host flow

- New role: `EVENT_HOST` (per ADR-0005).
- Sign-up route `/organizer/host/start` — magic-link, asks city + display
  name, no community required.
- New entity surface: an event-host has a lightweight "host profile" stored as
  `User.metadata.hostProfile = { displayName, city, links[] }` (no new table
  v1).
- `/organizer/host/events` — list + create + edit own events. Events posted
  here have `Event.communityId = null` and `Event.metadata.hostUserId =
user.id`.
- Event detail page renders host name + link instead of community card when
  `communityId` is null.
- Eligibility: event hosts can only edit/delete events they created; once
  approved, edits go through the standard pipeline review for material
  changes (date/venue/title), per PRD-0013.

## 5. Out of Scope

- Full Organization (multi-tenant) accounts for partners — separate future
  PRD.
- Paid events / ticketing — keep `registrationUrl` external.
- Host badges / verification — covered by general verified-badge work.
- Migrating existing anonymous public submissions retroactively into host
  accounts.

## 6. User Stories

- As an **organizer with two claimed communities**, I switch between them
  from a sidebar dropdown; every page in the portal reflects the active
  workspace.
- As an **event host**, I sign up with my email, post my first event, and
  see it live in my city's events feed within a day.
- As **Y**, I can send a cold-outreach link `/organizer/host/start` to a
  freelance teacher and they self-onboard.
- As **JP**, I can grep `Event.metadata.hostUserId` to count host-published
  events.

## 7. Acceptance Criteria (Gherkin)

```
Given a user with claimedCommunities = [A, B]
When they open /organizer
Then both A and B appear in the workspace switcher
And selecting B sets session.currentCommunityId = B and reloads the page

Given a user signs up via /organizer/host/start with city=stuttgart
Then their User.role primary becomes EVENT_HOST
And no Community is created

Given an event host posts an event
Then Event.communityId is null
And Event.metadata.hostUserId = user.id
And the event detail page renders the host attribution block

Given an event host attempts to edit an event they did not create
Then the response is 403
```

## 8. UX

- Workspace switcher: avatar + community name + chevron in top-left of
  organizer portal; reuses existing portal shell.
- `/organizer/communities` index: card grid with cover image, completeness %,
  last edit, "Open" button.
- Host onboarding: 2-step wizard (city → display name + optional links).
- Event detail attribution: "Hosted by {hostDisplayName}" with verified
  badge if granted.

## 9. Risks & Open Questions

- Hosts could pose as a community and crowd the events feed — mitigated by
  hard cap of 5 unverified upcoming events per host until manual review.
- Storing host profile in `User.metadata` is intentionally minimalist; revisit
  if hosts > 100 or we add host pages.
- Workspace switcher state in cookie may surprise users on multi-tab; we
  scope it to a `__Host-` cookie with `SameSite=Lax` and refresh on every
  switcher click.
