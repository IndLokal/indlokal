# PRD-0054: JITO Stuttgart × IndLokal Business Connect pilot

- **Status:** Approved
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0054, PRD-0033 (PII notice baseline), PRD-0020 (business discovery), ADR-0011 (composition layer), `docs/JITO_STUTTGART_BUSINESS_CONNECT_PILOT.md`, `apps/web/src/app/(info)/privacy`, `apps/web/src/app/(info)/terms`

## 1. Problem

IndLokal's strategy (`docs/PRODUCT_DOCUMENT.md` §14) sequences the product as Discovery →
Journeys → Personalization → Ecosystem → **Business** → **Connect** → Intelligence, and is explicit
that **Business (Phase 5) and Connect (Phase 6) must not launch as open products** — they must first
be validated through curated, trusted, manual workflows.

The JITO Stuttgart business event (23 June) is a high-trust, time-boxed opportunity: known community
leadership, business-oriented members, India/Germany participants, and chairman endorsement. We need
a way to capture **structured business intent** from this community and enable **manual, curated
introductions** — without building, or implying, a public marketplace. Access is **invite-only**:
the community organizer chooses who is invited, so the pilot never appears on the open web.

Why now: the event date is fixed (23 June 2026); the window to collect high-quality intent and
validate the curated-introduction hypothesis is the event itself.

## 2. Users & JTBD

- **India/Germany business participant:** "I want to express what I'm looking for and what I can
  offer to a trusted community, and be introduced only to genuinely relevant counterparts."
- **Founder / investor / advisor / service provider:** "I want to signal collaboration interest
  without my details being publicly listed or spammed."
- **IndLokal/JITO operator:** "I want clean, structured enquiry data and a simple review queue so I
  can make a small number of high-quality manual introductions after the event."
- **Product/strategy owner:** "I want to validate the Phase 5/6 hypothesis cheaply, with strong
  trust and privacy guarantees, before committing to a Business or Connect product."

## 3. Success Metrics

Trust and relevance over volume. Measured via `EVENTS/analytics.md` events (non-sensitive props
only):

- **Submission completion rate** — `business_connect_submit_success` / `business_connect_submit_started`.
- **Volume of qualified enquiries** — count of `business_connect_submit_success` for
  `pilotSlug = jito-stuttgart-2026-06-23` (target: a meaningful, reviewable set, not a large number).
- **Curated-introduction yield** (operational, off-platform) — number of submissions advanced to
  `SHORTLISTED`/`MATCHED` during manual review.
- **Trust integrity** — zero public exposures of submission data; 100% of submissions carry the two
  required consents and a recorded notice version.

## 4. Scope

1. **Invite-only**, JITO-specific landing page at `/jito-stuttgart/business-connect` (noindex)
   explaining the pilot, who it is for, the trust-first model, and that submissions are manually
   reviewed and do not guarantee an introduction. There is no public discovery (no homepage band,
   no footer link).
2. Organizer invite surface at `/organizer/business-connect`, where the JITO Stuttgart community
   organizer (COMMUNITY_ADMIN of the linked community) sends per-email invites and tracks their
   status. Reuses the existing community-collaborator permission model.
3. Structured enquiry form at `/jito-stuttgart/business-connect/submit` (Sections 1–6: participant
   type, looking-for, offering, business details, trust/event context, consent), reachable **only**
   via a valid per-email invite link (`?invite=<token>`), with the contact email locked to the
   invited address (noindex).
4. Inline success state after submission instructing the submitter to confirm via the emailed link.
5. Private persistence in `BusinessConnectSubmission` (linked to its `BusinessConnectInvite` via
   `inviteId`), saved as `PENDING_CONFIRMATION` and promoted to `NEW` once the double-opt-in link is
   confirmed. Invites persist in `BusinessConnectInvite` and are consumed atomically on submission.
6. Organizer review queue at `/organizer/business-connect` (list + inline detail), where the JITO
   Stuttgart community organizer (COMMUNITY_ADMIN of the linked community) is the primary reviewer
   for status + notes.
7. Admin oversight view at `/admin/business-connect` (read-only visibility), gated by
   `business_connect.read`.
8. Explicit consent capture (two required, one optional; none pre-checked) plus a recorded
   privacy-notice version (GDPR auditability, aligning with PRD-0033).
9. GDPR processing notice on the form and enumeration of the enquiry data flow in `/privacy`.
10. Basic, non-sensitive analytics (4 events) and per-submission rate limiting.

## 5. Out of Scope

- Public, openly discoverable access (the pilot is invite-only and noindex).
- Self-serve / open sign-up to the enquiry form without an organizer-issued invite.
- Public business directory, marketplace, or searchable enquiry board.
- User-to-user messaging, payments, subscriptions.
- AI/automated matching, auto-introductions, auto-publish.
- Public business profiles or investor marketplace.
- A generic `/business` or `/connect` product, or any new platform-wide taxonomy
  (pilot taxonomies stay pilot-scoped in `options.ts`, not `@indlokal/shared`).
- Mobile parity.

## 6. User Stories

- As a community organizer, I can invite specific guests by email from `/organizer/business-connect`
  and see whether each invite is outstanding or submitted.
- As an invited participant, I can open my personal invite link to read what the pilot is and is not
  before deciding to submit.
- As an invited participant, I can submit a structured enquiry describing what I'm looking for and
  offering; my contact email is fixed to the address my invite was sent to.
- As an uninvited visitor, I cannot reach or use the enquiry form (it is invite-only and noindex).
- As a participant, I must explicitly consent to manual review and acknowledge that introductions
  are curated and not guaranteed, before I can submit.
- As a participant, I can optionally consent to selected information being shared with a matched
  party after review.
- As an operator, I can view all enquiries privately and update status and notes.
- As a non-admin, I cannot reach the review page.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given an invited visitor opening their personal invite link on /jito-stuttgart/business-connect
When the page loads
Then it shows the JITO Stuttgart Business Event — 23 June context and a trust-first explanation,
  and it does not claim instant matching or guaranteed leads.
```

```gherkin
Given a visitor reaching /jito-stuttgart/business-connect/submit without a valid invite token
When the page loads
Then the enquiry form is not shown and an invite-only notice is displayed, and the route is noindex.
```

```gherkin
Given a community organizer (COMMUNITY_ADMIN of the linked community) on /organizer/business-connect
When they submit one or more email addresses
Then a BusinessConnectInvite is created per new address with a hashed token and a 30-day expiry,
  an invite email is sent to each, and the organizer sees the invites listed.
```

```gherkin
Given a participant on the invite-gated submit form
When they submit without the two required consents
Then submission is rejected with inline field errors and nothing is persisted.
```

```gherkin
Given a valid submission from a usable invite with both required consents
When it is persisted
Then the invite is marked used and a BusinessConnectSubmission row is created in the same
  transaction with status PENDING_CONFIRMATION, pilotSlug "jito-stuttgart-2026-06-23", inviteId set,
  contactEmail equal to the invited address, the stored consents, and a recorded consentPolicyVersion,
  a confirmation link is emailed, and the "check your inbox" success state is shown.
```

```gherkin
Given an invite that has already been used or has expired
When the submitter attempts to submit with it
Then submission is rejected with an "invite no longer valid" error and no new row is persisted.
```

```gherkin
Given a pending submission with a valid confirmation link
When the submitter clicks the link and confirms
Then the row is promoted to status NEW with emailConfirmedAt set, it becomes visible in the
  organizer review queue, and confirmation + team-notification emails are sent.
```

```gherkin
Given a submission exists
When a user without community-admin authority for the pilot community opens /organizer/business-connect
Then they cannot update Business Connect status or notes.
```

```gherkin
Given an organizer with community-admin authority on /organizer/business-connect
When they change a submission's status or save organizer/match notes
Then the change is persisted and the list reflects it.
```

```gherkin
Given any state
When anyone requests submission data over a public/unauthenticated path
Then no enquiry data is returned (no public read path exists).
```

## 8. UX

- Landing (invite-only, noindex): event label, headline, trust note, "who it is for",
  "how it works" (3 steps), and an invite-only notice telling guests to open their personal invite
  link or ask their JITO contact for one (no public submit CTA). Copy reinforces
  _curated / reviewed / trusted / pilot_; avoids _marketplace / instant match / guaranteed_.
- Organizer invite surface: the community organizer pastes one or more emails (comma/newline
  separated) with an optional note, sends invites, and sees each invite's status (awaiting
  submission / submitted / expired).
- Organizer review surface: confirmed enquiries appear in the same organizer workspace, where the
  organizer updates status and notes.
- Form (invite-gated): six labelled sections, mobile-first, single-column on small screens;
  multi-selects for looking-for/offering with conditional "Other" text; radios for participant type
  and yes/no/not-sure. The contact email field is locked to the invited address (read-only).
- Admin view: `/admin/business-connect` is read-only oversight, not the primary decision surface.
- States: validation errors inline; on submit the enquiry is saved as pending and an
  email-confirmation step (a double opt-in link emailed to the contact address) gates review — the
  success screen tells the submitter to check their inbox and that nothing is shared until they
  confirm. Clicking the link confirms the enquiry and shows a done state with links to the pilot's
  city page and `/`. On confirmation the submitter receives a confirmation email and the
  partnerships team a notification email.
- Consent block: three unchecked checkboxes (two required) + a plain-language GDPR processing notice
  naming IndLokal as controller, stating the legal basis (consent, Art. 6(1)(a) GDPR), and linking
  `/privacy`, `/terms`, and a `privacy@indlokal.com` withdrawal/erasure contact.
- A11y: labels bound to inputs; fieldsets/legends for radio groups; focusable notice links.

## 9. Risks & Open Questions

- **Risk — overclaiming.** Mitigation: copy review; no marketplace/match language; explicit
  "does not guarantee an introduction".
- **Risk — privacy/GDPR.** Mitigation: explicit consent, recorded notice version, no public read
  path, RBAC-gated admin, non-sensitive analytics only, `/privacy` enumerates the flow.
- **Risk — spam/abuse.** Mitigation: the form is **invite-only** — only an organizer-issued,
  single-use, 30-day per-email invite token unlocks it, the invite is consumed atomically on
  submission, and the contact email is locked to the invited address; plus required email
  confirmation (double opt-in) before an enquiry enters the review queue and per-IP rate limiting.
  The confirmation token is single-use with a 14-day window.
- **Resolved — invite issuance.** Per ADR-0008, invites are issued by the JITO Stuttgart community
  organizer (COMMUNITY_ADMIN of the linked community), not the IndLokal platform admin; the pilot is
  linked to its community via `communitySlug`.
- **Resolved — confirmation email.** Shipped: submitters get a confirmation and the team gets a
  notification once an enquiry is confirmed and promoted to review (best-effort, non-blocking).
- **Open question — reuse for a future JITO event.** Pilot slug/label are centralized constants;
  promoting them to config is deferred until a second event is actually scheduled.

## 10. Strategy mapping

This pilot is an early **Phase 4 (Ecosystem)** experiment and a validation input for future
**Phase 5 (Business)** and **Phase 6 (Connect)** layers. It is intentionally curated and private —
not a public marketplace, not a business directory, and not an automated matching system. The
objective is to validate whether trusted, community-backed business enquiries can produce meaningful
curated introductions between India- and Germany-linked businesses.
