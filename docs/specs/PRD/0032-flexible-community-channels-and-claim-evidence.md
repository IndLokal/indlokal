# PRD-0032: Flexible community channels and claim evidence capture

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0032, PRD-0031, PRD/TDD-0009

## 1. Problem

Channel capture is inconsistent across flows:

1. Submission flow allows only primary + secondary channels.
2. Claim flow uses three fixed proof-link fields.
3. New-community creation from outreach creates a community with no channels.
4. Organizer channel management supports incremental add/remove after claim.

This inconsistency creates a poor first-time UX:

- Asking for many fixed fields upfront increases drop-off.
- Limiting users to 1-2 channels blocks valid submissions.
- Claimants can have evidence links beyond the fixed three fields.

## 2. Users & JTBD

- **Submitter:** I want to provide the channels I actually use without being forced into a fixed two-field form.
- **Claimant:** I want to share sufficient proof links without being constrained to specific hardcoded fields.
- **Admin reviewer:** I want consistent, readable channel/evidence data in review screens.
- **Outreach operator:** when promoting a lead to community, I want to seed at least one contact channel quickly.

## 3. Success Metrics

- +15% submission completion rate for users who add more than one channel.
- <2% validation failures caused by channel form rigidity.
- Claim approval decision time reduced by richer evidence context.
- Reduced manual admin follow-up asking for missing channels/evidence.

## 4. Scope

Phase 1 (Submission channel flexibility):

- Replace fixed primary/secondary fields in web submit form with repeater UI.
- Require at least one valid channel; allow up to max 6 channels.
- Keep "Set as primary" behavior with exactly one primary channel.
- Extend API contract for community submissions to support channels array.

Phase 2 (Claim evidence flexibility):

- Replace fixed WhatsApp/Telegram/Social fields with optional repeater evidence links.
- Support typed evidence link entries (e.g., WHATSAPP, TELEGRAM, WEBSITE, SOCIAL, OTHER).
- In the claim evidence repeater UI, a type already selected in one row should not appear in remaining row selectors.

Phase 3 (New-community creation flow parity):

- Add optional channel input when promoting outreach lead to community.
- Persist provided channels during create.

## 5. Out of Scope

- Channel verification automation (link health checks).
- Multi-owner approval workflows.
- Bulk CSV import redesign.
- Mobile-native UI parity in this iteration (API support included; mobile screen update can follow).

## 6. User Stories

- As a submitter, I can click "+ Add channel" repeatedly and submit with all relevant links.
- As a submitter, I can submit with one channel without filling unnecessary optional fields.
- As a claimant, I can add as many proof links as needed (within cap) without hardcoded field labels.
- As an admin, I can see clear channel/evidence entries in submissions and claims.

## 7. Acceptance Criteria

```gherkin
Given a user is on community submission form
When they add 3 channels and mark one primary
Then submission succeeds
And all 3 channels are persisted with one primary.
```

```gherkin
Given a user adds duplicate channel URL/type pairs
When submitting
Then form rejects with a clear duplicate-channel error.
```

```gherkin
Given a claimant provides 4 evidence links
When claim is submitted
Then claim metadata stores all 4 entries as structured evidence links.
```

```gherkin
Given a claimant selects WHATSAPP as evidence type in row 1
When they open the type selector in row 2
Then WHATSAPP is not shown as an available option.
```

```gherkin
Given an outreach lead is promoted to community with one channel entered
When promotion completes
Then created community includes that access channel.
```

## 8. UX Principles

- Progressive disclosure: start with one channel row, reveal "+ Add channel" for more.
- Low cognitive load: avoid asking for N fixed fields up front.
- Strong guardrails: one primary channel, max cap, URL validation, duplicate prevention.
- Explain intent: "Add more only if useful for discovery/joining."

## 9. Risks & Open Questions

- **Risk:** too many low-quality links increase moderation load.
  - Mitigation: cap count + basic dedupe + admin visibility.
- **Risk:** API breaking change for existing clients.
  - Mitigation: backward-compatible contract period supporting legacy fields and new array.
- **Open question:** should claim evidence links write into `accessChannels` after approval or stay as review-only evidence?
- **Decision:** max channel count is fixed at 6 for this iteration.
