# Submission and Suggestion Flows - Documentation Index

**Last updated:** 2026-06-15

This index maps all submission and suggestion flow documentation across IndLokal.

---

## Quick Links

### Unified Policy & Routing

- **[SUBMISSION_AND_SUGGESTION_FLOWS.md](./SUBMISSION_AND_SUGGESTION_FLOWS.md)** — Master policy document. Start here for:
  - Core principles (broad discovery + strict verification, ownership intent, trust lanes)
  - Universal routing table (how submissions/suggestions are queued by entity type and trust lane)
  - Data model alignment (enums, ContentReport, PipelineItem)
  - Queue destinations and SLAs
  - Analytics taxonomy
  - Feature flag strategy

### Per-Entity-Type Flow Documents

**Community:**

- **[COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md)** — Deep dive on community submissions and light suggestions
  - Full submission form (4 sections: details, classification, channels, contact+relationship)
  - Light contribution form (`/contribute?type=community` or `/[city]/contribute?type=community`)
  - Admin review and approval workflow
  - Relationship intent outcomes (HELP_RUN vs JUST_ADDING)
  - Operational procedures and decision guides
  - 11 sections, ~2000 lines

**Events:**

- **[EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md](./EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md)** — Event creation and suggestions
  - Organizer event submission (auto-publish if organizer trusted)
  - Community event suggestions (queued for admin/ops review)
  - Host event submission (future; queued for moderation)
  - Event dedup logic (temporal + venue-aware)
  - Moderation state transitions (PENDING_REVIEW → PUBLISHED)
  - 14 sections, ~1500 lines

**Resources:**

- **[RESOURCE_SUGGESTION_FLOW.md](./RESOURCE_SUGGESTION_FLOW.md)** — Resource tips and suggestions
  - Resource suggestion form (scope-aware, not city-scoped)
  - Feature flag strategy (PIPELINE_RESOURCE_LANE_ENABLED)
  - Resource dedup logic (scope + geographic area overlap)
  - Blocked by PRD/TDD-0056 resource model spec
  - 14 sections, ~1000 lines

---

## Related Specifications

**Product Requirements:**

- [PRD-0057: Unified Suggestion Intake (Community, Event, Resource)](./specs/PRD/0057-unified-suggestion-intake-community-event-resource.md) — Spec for the user-facing Contribute hub, entity-type branching, typed contribution server actions
- [PRD-0009: Community Submission](./specs/PRD/0009-community-submission-and-claim.md) (if exists; reference only)
- [PRD-0037: Event Governance](./specs/PRD/0037-event-governance-and-lifecycle.md) (if exists; reference only)
- [PRD-0056: Resource Pipeline](./specs/PRD/0056-resource-discovery-and-pipeline.md) (BLOCKED; not yet available)

**Technical Design:**

- [TDD-0057: Unified Suggestion Intake (Architecture + Data Model)](./specs/TDD/0057-unified-suggestion-intake-community-event-resource.md) — Implementation plan for contribution routes, typed contribution forms, server actions, database migrations
- [TDD-0009: Community Submission](./specs/TDD/0009-community-submission-and-claim.md) (if exists; reference only)
- [TDD-0037: Event Governance](./specs/TDD/0037-event-governance-and-lifecycle.md) (if exists; reference only)
- [TDD-0056: Resource Pipeline](./specs/TDD/0056-resource-discovery-and-pipeline.md) (BLOCKED; not yet available)

**Operational Guides:**

- [SOURCE_AND_EVIDENCE_POLICY.md](./SOURCE_AND_EVIDENCE_POLICY.md) — Trust signal classification (verified vs source-supported vs insufficient)
- [COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md) — How organizers claim existing communities
- [COMMUNITY_ORGANIZER_ADMIN_FLOW.md](./COMMUNITY_ORGANIZER_ADMIN_FLOW.md) — Organizer dashboard and admin workflows
- [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) — Event model, authority, and publication rules
- [EVENT_AND_COMMUNITY_DEDUP_GUIDE.md](./EVENT_AND_COMMUNITY_DEDUP_GUIDE.md) — Duplicate detection and handling procedures

---

## Navigation Patterns

### I'm implementing a feature related to...

**...community suggestions?**  
→ Read [SUBMISSION_AND_SUGGESTION_FLOWS.md](./SUBMISSION_AND_SUGGESTION_FLOWS.md#52-community) (overview)  
→ Then [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md) (deep dive)  
→ Check TDD-0057 for implementation details

**...event submissions/suggestions?**  
→ Read [SUBMISSION_AND_SUGGESTION_FLOWS.md](./SUBMISSION_AND_SUGGESTION_FLOWS.md#53-event) (overview)  
→ Then [EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md](./EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md) (deep dive)  
→ Cross-reference [EVENTS_AND_LIFECYCLE.md](./EVENTS_AND_LIFECYCLE.md) for event model context  
→ Check TDD-0057 for implementation details

**...resource suggestions?**  
→ Read [SUBMISSION_AND_SUGGESTION_FLOWS.md](./SUBMISSION_AND_SUGGESTION_FLOWS.md#53-resource) (overview)  
→ Then [RESOURCE_SUGGESTION_FLOW.md](./RESOURCE_SUGGESTION_FLOW.md) (deep dive)  
→ **BLOCKED:** Wait for PRD/TDD-0056 resource model spec before full implementation  
→ Check TDD-0057 for suggestion intake mechanics

**...operators reviewing submissions?**  
→ [COMMUNITY_SUBMISSION_FLOW.md § Step 3](./COMMUNITY_SUBMISSION_FLOW.md#step-3---platform-admin-review)  
→ [EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md § Step 3](./EVENT_SUBMISSION_AND_SUGGESTION_FLOW.md#step-3---adminops-review)

**...deduplication and collision handling?**  
→ [SUBMISSION_AND_SUGGESTION_FLOWS.md § 9 Deduplication](./SUBMISSION_AND_SUGGESTION_FLOWS.md#9-deduplication-and-collision-handling)  
→ [EVENT_AND_COMMUNITY_DEDUP_GUIDE.md](./EVENT_AND_COMMUNITY_DEDUP_GUIDE.md)

**...queue routing and pipeline integration?**  
→ [SUBMISSION_AND_SUGGESTION_FLOWS.md § 4 Universal Routing Policy](./SUBMISSION_AND_SUGGESTION_FLOWS.md#4-universal-routing-policy)  
→ [SUBMISSION_AND_SUGGESTION_FLOWS.md § 7 Queue and Moderation Destinations](./SUBMISSION_AND_SUGGESTION_FLOWS.md#7-queue-and-moderation-destinations)

---

## Key Concepts

### Trust Lanes

All submissions/suggestions classify into one of three trust lanes:

- **OPERATOR_TRUSTED** — Organizer/host with verified account; auto-publish or conditional publish
- **IDENTIFIED_CONTRIBUTOR** — Authenticated user with some history; queued for review
- **PUBLIC_UNTRUSTED** — Anonymous or light-auth user; queued for review (lower priority)

### Ownership Intent

Submitters declare their relationship to the entity at intake time. On approval, the platform executes that intent:

- **HELP_RUN (communities)** → Submitter becomes organizer
- **JUST_ADDING (communities)** → Community published, unclaimed, claimable by anyone
- **HOSTING_THIS_EVENT (events)** → Submitter marked as event host
- **SHARING_A_TIP (events/resources)** → Entity attributed to pipeline, not submitter

### Publication Gates

**All public-discoverable content requires human review before visibility**, except:

- Organizer-created events (auto-publish if organizer verified)
- Admin-created resources (high trust)

### Queues

- **Admin submissions queue** — Full submissions from identified contributors
- **Pipeline discovery queue** — Lightweight suggestions from all trust lanes
- **Event moderation queue** — Event-specific review (publication state separate from suggestion queue)
- **Resource queue** (gated by PIPELINE_RESOURCE_LANE_ENABLED flag)

---

## Rollout Roadmap (Tentative)

**Phase 1 (MVP - 2026-Q3):**

- ✅ Unified policy documented
- ✅ Community submission/suggestion flows operational
- ✅ Event submission (organizer) operational
- ⏳ Event contribution form & review queue (behind UNIFIED_CONTRIBUTION_INTAKE_ENABLED flag)
- ⏳ Resource contribution form (content only, no queue yet)

**Phase 2 (2026-Q4):**

- Resource pipeline queue (PIPELINE_RESOURCE_LANE_ENABLED flag enables)
- Host event submission (independent host form)
- Advanced dedup & merge tooling

**Phase 3 (2027-Q1):**

- Resource submission form (admin + provider self-service)
- Bulk import from external directories
- Organizer-suggested-event escalation

---

## Document Maintenance

**Owners:** John (Product Manager), Mary (Business Analyst), Amelia (Engineering Lead)

**Update frequency:** Quarterly (or when specs 0056/0057 finalize)

**Last reviewed:** 2026-06-15  
**Next review:** 2026-09-15 (post-Phase 1 launch metrics)
