# PRD-0033: Submission and claim PII notice baseline

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0033, PRD-0031, PRD-0032, docs/(info)/privacy, docs/(info)/terms

## 1. Problem

IndLokal collects personal data (name + email) in user-generated flows such as community submission and claim requests. We already have privacy and terms pages, but the forms do not consistently provide explicit, contextual consent language and auditable proof of that acknowledgment.

Current risk is not "no legal pages"; it is weak consent UX evidence at the moment of collection.

## 2. Users & JTBD

- **Submitter/claimant:** I want clear, plain-language information about why my personal data is needed before I submit.
- **Operator/admin:** I want confidence that personal data was collected with explicit user acknowledgment.
- **Product/legal owner:** I want a pragmatic GDPR baseline now, without building a full compliance platform.

## 3. Success Metrics

- 100% of required-name/email flows show inline collection notice with legal links at point of submission.
- 100% of new submission/claim records contain notice receipt fields in metadata.
- No measurable increase in form error/support tickets from consent UX changes.

## 4. Scope

Phase 1 (baseline, now):

1. Add explicit inline collection notice copy with links to `/privacy` and `/terms` on:
   - `/submit` (community self-submission)
   - claim form (`/[city]/communities/[slug]` claim section)
2. Store notice receipt in metadata for new writes:
   - submission metadata: `metadata.submitter.notice`
   - claim metadata: `metadata.claimRequest.notice`
3. Notice receipt fields:
   - `policyVersion` (string constant, v1)
   - `source` (e.g., `submit_form`, `claim_form`)
   - `recordedAt` (ISO timestamp)

Phase 2 (follow-up, only if needed):

- Expand equivalent treatment to optional-email report/suggest flows.
- Add retention automation for low-risk report PII.

## 5. Out of Scope

- Cookie consent manager / CMP implementation.
- Full DSAR automation portal.
- DPO workflow tooling.
- New legal basis engine or geolocation-specific legal branching.
- Rewriting entire privacy policy text.

## 6. User Stories

- As a submitter, I can see why my name/email is collected before submitting.
- As a claimant, I can see data-use notice and legal links before sending claim details.
- As an admin, I can verify that notice receipt metadata was captured with timestamp.

## 7. Acceptance Criteria

```gherkin
Given a user submits community form
When the submission is persisted
Then metadata.submitter.notice includes policyVersion, source, and recordedAt.
```

```gherkin
Given a user submits a claim
When claim metadata is updated
Then metadata.claimRequest.notice contains policyVersion, source, and recordedAt.
```

## 8. UX

Principles:

- Keep copy short and non-legalistic.
- Place consent immediately above submit CTA.
- Avoid modal interruptions.

Proposed copy (v1):

- "By submitting, you agree that IndLokal may process your submitted name and email to review this request, as described in the Privacy Policy and Terms."

A11y:

- Notice links must be keyboard focusable and readable on mobile.

## 9. Risks & Open Questions

- **Risk:** Policy text/version drift over time.
  - Mitigation: centralized `CONSENT_POLICY_VERSION` constant.
- **Open question:** Should optional-email suggest/report flows add the same inline notice in v1 or Phase 2?
  - Proposed: defer to Phase 2 to avoid over-expansion now.
