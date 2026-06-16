# PRD-0057: Unified Contribution Intake (Community, Event, Resource)

**Status:** Draft → Implementation (v1.0 scope: Community + Event only)  
**Linked:** PRD/TDD-0009, PRD/TDD-0013, PRD/TDD-0037, PRD/TDD-0056, docs/COMMUNITY_SUBMISSION_FLOW.md, docs/EVENTS_AND_LIFECYCLE.md  
**Owner:** PM (John)  
**Contributors:** BA (Mary), Engineering, Ops  
**Created:** 2026-06-15  
**Scope note:** Resource contribution form designed in this PRD but deferred to v1.1 (Phase 2), pending TDD-0056 (resource model + scope/region dedup). Hub resource tab visible in v1.0 but disabled ("Coming soon").

---

## 1. Why now

IndLokal has a robust community submission path and strong moderation rails, but the public contribution surface is fragmented:

- City contribution UX claims community/resource contributions, but backend handling is community-only.
- There is no explicit visitor-facing event contribution lane.
- Users must choose between contribute vs submit paths with unclear intent boundaries.

This creates supply blind spots (especially events), moderation noise, and analytics ambiguity.

## 2. Problem statement

The product needs one clear user-facing way to contribute missing listings while preserving trust controls and type-specific moderation outcomes.

Today, contribution is not a first-class cross-entity workflow. It behaves differently by surface and cannot be measured consistently.

## 3. Product decision

Adopt a **hybrid model**:

1. Introduce a single user-facing Contribute hub as canonical entry point for "something is missing".
2. Keep entity-specific forms and validations for data quality.
3. Route each contribution type to the right queue and trust lane.

This gives one simple user mental model without forcing one over-generalized form.

## 4. Goals

| Goal                  | Acceptance criterion                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| G1: One entry model   | Users can start from one Contribute hub and choose Community/Event/Resource |
| G2: Event gap closed  | Visitor-facing event contribution lane exists in web and mobile parity plan |
| G3: Trust preserved   | All public contributions remain review-gated before public visibility       |
| G4: Queue clarity     | Contributions route to explicit moderation destinations by entity type      |
| G5: Measurable funnel | End-to-end metrics exist per entity type and per lane                       |

## 5. Non-goals

- Replacing organizer/host event creation flows.
- Replacing full community self-submission (`/submit`) for ownership intent.
- Auto-publishing public contributions.
- Redesigning pipeline architecture.

## 6. User and job stories

1. As a member, when I see a missing event, I can quickly contribute it without pretending I am the host.
2. As a member, when I know a missing community or resource, I can contribute it in one place and track that it is under review.
3. As an operator, I can triage contributions with clear entity type, confidence, and provenance.
4. As PM/Ops, I can measure contribution conversion and quality by entity type.

## 7. UX and IA approach

**Naming convention:** Product and implementation language use **Contribute** for the hub, nav labels, CTAs, public routes, app-layer services, analytics, and queue labels. Existing `SUGGEST_*` and `*_SUGGESTION` identifiers are legacy storage/API names and should be wrapped by contribution-language code rather than exposed in UI or new app-layer APIs.

### 7.1 Primary entry

- New route: `/[city]/contribute` is the city-level canonical contribution entry.
- Top-level entry: `/contribute`, where users select the city inside the relevant form.

### 7.2 Hub behavior

On `/contribute` or `/[city]/contribute`, first step is intent/type choice:

- Contribute a community
- Contribute an event
- Contribute a resource

Then branch to typed forms with only relevant required fields.

### 7.3 Keep page-specific CTAs

Existing page CTAs (communities/events/resources) should deep-link into the hub with preselected type, for example:

- `/[city]/contribute?type=community`
- `/[city]/contribute?type=event`
- `/contribute?type=resource` when the resource lane is enabled

This preserves contextual UX while unifying backend taxonomy.

## 8. Intake taxonomy (canonical)

All contributions use a normalized envelope:

- `entityType`: COMMUNITY | EVENT | RESOURCE
- `intakeMode`: CONTRIBUTE (this PRD), separate from SUBMIT and REPORT
- `trustLane`: PUBLIC_UNTRUSTED | IDENTIFIED_CONTRIBUTOR | OPERATOR_TRUSTED
- `ownershipIntent` (when applicable):
  - COMMUNITY: HELP_RUN | JUST_ADDING
  - EVENT: HOSTING_THIS_EVENT | SHARING_TIP
  - RESOURCE: REPRESENT_PROVIDER | JUST_CONTRIBUTING

## 9. Routing policy (v1)

| Input                 | Entity    | Route destination                                                              | Publish behavior |
| --------------------- | --------- | ------------------------------------------------------------------------------ | ---------------- |
| Public contribute     | COMMUNITY | Pipeline queue (community contribution source) + admin review                  | Review required  |
| Public contribute     | EVENT     | Pipeline queue (event contribution source) + admin event review                | Review required  |
| Public contribute     | RESOURCE  | Pipeline queue (resource contribution source) + admin pipeline/resource review | Review required  |
| Full self-submit      | COMMUNITY | Existing submissions queue                                                     | Existing policy  |
| Organizer/host create | EVENT     | Existing event lanes                                                           | Existing policy  |

## 10. Data and platform changes (product-level)

1. Add first-class contribution typing for event and resource in intake models.
2. Extend report/contribution classification so contributions are not forced into community-only semantics.
3. Add pipeline source labels for `EVENT_SUGGESTION` and `RESOURCE_SUGGESTION` (community contribution source remains).
4. Ensure all contribution records carry city, submitter channel (anon/auth), and dedup signals.

## 11. Metrics (first 60 days)

### 11.1 North-star

- **Verified additions from contributions per week** (community + event + resource).

### 11.2 Funnel and quality

- Contribution start to completion rate by entity type.
- Contribution to first-review SLA (median, P90).
- Acceptance rate by entity type.
- Duplicate rate by entity type.

### 11.3 Guardrails

- Reversal/correction rate for approved contributions.
- Moderation backlog age P90.
- Spam/abuse rate per 100 contributions.

## 12. Risks and mitigations

1. Queue overload after opening event contributions.
   - Mitigate with city allowlist rollout, triage priority, and per-day moderation budget.
2. Low-quality event tips.
   - Mitigate with minimum required fields: event name, date/time hint, city, source link if available.
3. User confusion between Contribute and Submit.
   - Mitigate with explicit intent copy: "Contribute what is missing" vs "I run this and want to submit/manage it".
4. Taxonomy drift across web/mobile.
   - Mitigate by central shared contracts in `packages/shared` and canonical analytics names.

## 13. Rollout plan

1. Phase A: Ship hybrid UX in one pilot city (Stuttgart) with feature flag.
2. Phase B: Expand to all active cities once SLA and quality thresholds are stable.
3. Phase C: Add mobile parity and richer contribution attachments (optional image/link evidence).

## 14. Acceptance criteria

- [ ] `/contribute` and `/[city]/contribute` support Community/Event/Resource paths in one flow.
- [ ] Event contribution is available to visitors without host onboarding.
- [ ] Resource contribution has explicit typed path, not community aliasing.
- [ ] Contribution records are queryable by entity type end-to-end.
- [ ] Admin queues can filter contribution items by entity type and status.
- [ ] Canonical analytics events are emitted for start, submit, review decision.
- [ ] Existing `/submit` and organizer/host flows remain unchanged.

## 15. Open questions

1. Should event contributions allow optional flyer image in v1 or defer to v2?
2. Should anonymous contributions be allowed for all types, or only authenticated users for events?
3. Should resource contributions route through pipeline queue only, or also appear in reports queue for ops triage?
