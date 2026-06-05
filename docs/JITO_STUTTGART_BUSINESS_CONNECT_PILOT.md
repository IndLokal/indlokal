# JITO Stuttgart × IndLokal Business Connect Pilot

> **Specs:** [PRD-0054](specs/PRD/0054-jito-stuttgart-business-connect-pilot.md) ·
> [TDD-0054](specs/TDD/0054-jito-stuttgart-business-connect-pilot.md). This document is the
> operator-facing summary; the PRD/TDD are the authoritative spec-driven source.

## Purpose

Allow Indian and German businesses attending or connected to the **JITO Stuttgart business
event (23 June)** to submit structured business enquiries, offers, and collaboration interests.
Access is **invite-only**: the JITO Stuttgart community organizer issues a per-email invite, and
only that personal link unlocks the enquiry form. Every submission is reviewed **manually** by
IndLokal/JITO before any introduction is made.

The objective is to collect high-quality, structured business intent data and enable **manual,
curated matching** later — validating future India–Germany business connection features through a
trusted community environment rather than an open product.

## Scope

### What this pilot is

- An **invite-only** JITO-specific landing page: `/jito-stuttgart/business-connect` (noindex)
- A structured enquiry form: `/jito-stuttgart/business-connect/submit`, reachable **only** via a
  valid per-email invite link (`?invite=<token>`); the contact email is locked to the invited
  address (noindex)
- An organizer-issued invite surface: `/organizer/business-connect`, where the JITO Stuttgart
  community organizer (COMMUNITY_ADMIN) sends and tracks per-email invites
- An email-confirmation step (double opt-in link) before an enquiry reaches the review team
- A confirmation / success state after submission
- Private data persistence (`BusinessConnectSubmission`, `BusinessConnectInvite`)
- An organizer review workspace: `/organizer/business-connect` (status + notes)
- An admin oversight view: `/admin/business-connect` (read-only visibility)
- A basic status lifecycle with organizer/match notes
- Explicit consent capture and trust/referral fields
- No public discovery: there is no homepage band, no footer link, and the routes are noindex

### What this pilot is NOT

- Not a public business directory
- Not a marketplace or searchable enquiry board
- Not user-to-user messaging, payments, or subscriptions
- Not AI/automated matching or auto-introductions
- Not a generic `/business` or `/connect` product
- Not public business profiles or an investor marketplace

Everything remains **curated and private**. There is no public read path for submissions and no
auto-publish.

## Data captured

Stored in `business_connect_submissions` (`BusinessConnectSubmission`):

- `pilotSlug` — `jito-stuttgart-2026-06-23`
- Participant type (single)
- Looking for (multi) + optional "other" free text
- Offering (multi) + optional "other" free text
- Company name, country, city, industry, business description, specific ask
- Contact name, contact email
- Optional: website, LinkedIn, phone/WhatsApp, preferred geography
- Trust/event context: attending event (yes/no/not sure), partner member (yes/no/not sure; the
  question label is per-pilot, e.g. "Are you a JITO member?"),
  referred by, chapter/org association
- Consent: review consent (required), manual-intro understanding (required), share-selected-info
  (optional). No consent box is pre-checked.
- Email confirmation: `emailConfirmationTokenHash` (SHA-256 of the one-time link token),
  `emailConfirmedAt` (set when the link is clicked).
- Invite link: `inviteId` (the `BusinessConnectInvite` this enquiry was submitted from). The contact
  email is forced server-side to the invited address — the posted value is never trusted.
- Lifecycle: `status` (default `PENDING_CONFIRMATION`, promoted to `NEW` on confirmation),
  `adminNotes`, `matchNotes`, timestamps

## Invite-only access

Business Connect is **not** open to the public web. Access is gated by a per-email invite issued by
the pilot's community organizer.

- The pilot is linked to a community via `communitySlug` (`jito-stuttgart`). The organizer surface
  and the invite flow are scoped to that community.
- The **JITO Stuttgart community organizer** (a `COMMUNITY_ADMIN` of the linked community, per
  ADR-0008) issues invites at `/organizer/business-connect` — not the IndLokal platform admin. This
  reuses the existing community-collaborator permission model
  (`canInviteCommunityCollaborators`).
- Each invite is one `BusinessConnectInvite` row: `email`, `tokenHash` (SHA-256 of the link token —
  the raw token lives only in the emailed link), `communityId`, `invitedByUserId`, `expiresAt`
  (30-day TTL), and `usedAt`. Only a valid, **unused**, **unexpired** invite unlocks the form.
- The submit form reads the token from `?invite=<token>`, resolves the invite, and **locks the
  contact email** to the invited address. The pilot is resolved from the invite, never from client
  input.
- The invite is consumed **atomically** when the enquiry is persisted (a single transaction marks
  `usedAt` and creates the submission), so one invite admits exactly one submission.
- Invite-only gating and the double opt-in confirmation are **both** retained: the invite controls
  _access_, while the confirmation link still proves the email is reachable.

## Review workflow

1. The JITO Stuttgart community organizer invites a guest by email at `/organizer/business-connect`;
   the guest receives a personal invite link. Only that link opens the enquiry form, with the
   contact email locked to the invited address.
2. A business fills the enquiry form. Because there is no public account, the enquiry is saved as
   `PENDING_CONFIRMATION` and we email a one-time **confirmation link** to the contact address
   (double opt-in). The enquiry only enters the review queue once that link is clicked, which proves
   the email is real and reachable.
3. On confirmation the row is promoted to `NEW`, the business gets a confirmation email, and the
   partnerships team gets a notification email with a link to the review queue.
4. The JITO Stuttgart organizer team reviews it at `/organizer/business-connect`.
5. Status moves through `NEW → REVIEWED → SHORTLISTED → MATCHED` (or `REJECTED` / `ARCHIVED`).
6. Organizers record `adminNotes` and `matchNotes`. Introductions are made manually, off-platform.
7. Admins keep oversight visibility at `/admin/business-connect`.

Status lifecycle: `PENDING_CONFIRMATION` (system, pre-confirmation), then `NEW`, `REVIEWED`,
`SHORTLISTED`, `MATCHED`, `REJECTED`, `ARCHIVED`.

The invite controls access and email confirmation only proves the address is reachable — the
**manual organizer review remains the real trust gate**.

## Trust & privacy rules

- Submissions are **private** — no public listing, no public read API.
- Organizer review authority is community-scoped: only `COMMUNITY_ADMIN` of the pilot community can
  update Business Connect status/notes in `/organizer/business-connect`.
- Admin access at `/admin/business-connect` is oversight-only (`business_connect.read`): visibility
  without being the primary decision surface.
- No automated matching and no auto-introductions.
- Consent is explicitly stored; selected information is shared only with a relevant matched party,
  and only after review.
- **GDPR:** IndLokal is the data controller. The legal basis for processing is the submitter's
  consent (Art. 6(1)(a) GDPR). The submit form shows a processing notice that names the controller,
  states the legal basis, explains that data is shared with a matched party only with the optional
  consent, and links to the `/privacy` and `/terms` pages plus a `privacy@indlokal.com` contact for
  withdrawal / access / erasure requests.
- Analytics capture **non-sensitive** properties only (`pilotSlug`, `participantType`,
  `attendingEvent`, `isPartnerMember`) — never free-text business data.
- The landing and submit pages are **noindex** (invite-only); submission data is never exposed or
  indexed.

## Analytics

Events (PostHog, defined in `apps/web/src/lib/analytics/events.ts`):

- `business_connect_page_view`
- `business_connect_submit_started`
- `business_connect_submit_success`
- `business_connect_submit_error`

Properties: `pilotSlug`, and where relevant `participantType`, `attendingEvent`, `isPartnerMember`.

## Future mapping (Phase 4/5/6)

This pilot maps to the IndLokal Product Strategy as an early **Phase 4 Ecosystem** experiment and a
validation input for future **Phase 5 Business** and **Phase 6 Connect** layers.

It is intentionally curated and private. It is not a public marketplace, not a business directory,
and not an automated matching system.

The objective is to validate whether trusted community-backed business enquiries can produce
meaningful curated introductions between India- and Germany-linked businesses.
