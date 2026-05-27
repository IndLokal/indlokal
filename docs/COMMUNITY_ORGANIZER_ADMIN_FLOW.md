# Community Organizer Admin Flow (Product Blueprint)

## 1. Purpose and Scope

This document defines the target organizer admin product for IndLokal.

It covers:

- Organizer workspace model for multi-community users
- Collaborator lifecycle as a first-class team workflow
- Community operations across profile, links, and events
- Admin moderation touchpoints for safe access governance

It does not describe implementation internals or code-level audit findings. It is a product operating blueprint.

For claim ownership initiation, see [COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md).

## 2. Product Outcomes

The organizer console should reliably deliver three outcomes:

1. Context certainty: organizer always knows which community they are operating.
2. Team operability: owner can delegate safely and track collaborator state.
3. Operational velocity: profile updates, link maintenance, and event publishing are predictable and fast.

## 3. Personas

### 3.1 Primary owner

Runs the community and remains owner of record.

### 3.2 Collaborator manager

Approved co-operator who helps maintain profile, links, and events.

### 3.3 Multi-community operator

Runs two or more communities and must switch context often without errors.

### 3.4 Platform admin

Moderates collaborator access requests and handles exceptional governance actions.

## 4. Product Principles

1. Workspace-first design: every organizer action is scoped to one active community.
2. Explicit roles: owner and collaborator are visible and distinct.
3. State transparency: pending, approved, rejected statuses are always visible.
4. Deterministic navigation: clear route ownership by task, no mixed-purpose ambiguity.
5. Safe default governance: collaborator access requires admin moderation in v1.

## 5. Relationship Model

- One community has one owner of record.
- One community can have many collaborators.
- One user can operate many communities as owner and/or collaborator.

Ownership and collaboration are intentionally separate concepts.

## 6. Information Architecture

## 6.1 Global organizer shell

Required shell elements:

- Active workspace identity: community name, city, and role label
- Workspace switcher: quick switch and deep link to full communities index
- Core navigation: Overview, Communities, Profile, Community Links, Collaborators, Events
- Global primary action: New Event

## 6.2 Canonical route map

- `/organizer`: overview for active community
- `/organizer/communities`: all accessible communities and switch controls
- `/organizer/profile`: profile editor for active community
- `/organizer/links`: channel manager for active community
- `/organizer/collaborators`: team management for active community
- `/organizer/events`: events list for active community
- `/organizer/events/new`: event creation for active community

Compatibility redirects:

- `/organizer/edit` -> `/organizer/profile`
- `/organizer/channels` -> `/organizer/links`

Host routes remain separate and are not merged into community organizer IA.

## 7. Page Product Contracts

## 7.1 Overview

Goal: daily operations cockpit.

Must contain:

- health strip: profile completeness, active collaborators, pending requests, upcoming events
- next-best-actions list: complete profile, add primary channel, invite collaborator, add event
- public preview links to community page and event outputs

## 7.2 Communities

Goal: multi-community control center.

Must contain:

- all accessible communities with role badge
- active marker and switch action
- profile completeness and city context
- fast open into active workflow

## 7.3 Profile

Goal: structured community data editing.

Must contain:

- active workspace banner
- grouped fields with validation states
- clear publish-surface messaging
- reliable success and error feedback

## 7.4 Community Links

Goal: access channel lifecycle management.

Must contain:

- current links table/list with primary indicator
- add link flow with type, URL, optional label, primary toggle
- remove link action
- one-primary invariant messaging

## 7.5 Collaborators

Goal: complete team workflow for a community.

Must contain:

- owner block and role explanation
- active collaborators list
- pending requests list with source and age
- invite form with idempotent duplicate handling
- status microcopy for approval path and expectations

## 7.6 Events

Goal: community-scoped event operations.

Must contain:

- list page with upcoming and past sections
- create flow that confirms target community
- visible submit state and clear post-submit result

## 8. End-to-End Flows

## 8.1 Login and context resolution

1. User authenticates.
2. Product resolves all accessible communities.
3. Product resolves active workspace from saved selection or deterministic fallback.
4. Organizer lands in overview with explicit active context.

## 8.2 Community switch

1. User picks a different community.
2. Product verifies access.
3. Product switches active context and returns user to intended organizer path.
4. New context is immediately visible in header and page banner.

## 8.3 Owner invite collaborator

1. Owner/collaborator submits invite email.
2. Product creates or reuses pending request.
3. Admin moderates request.
4. On approval, collaborator appears in active roster and gains access.

## 8.4 Public request collaborator access

1. User opens claimed community public page.
2. User requests organizer access.
3. Product records pending request.
4. Admin approves/rejects.
5. Ownership remains unchanged regardless of decision.

## 9. Permission Matrix (v1)

| Capability                              | Owner | Collaborator | Platform Admin               |
| --------------------------------------- | ----- | ------------ | ---------------------------- |
| View organizer workspace for community  | Yes   | Yes          | Yes                          |
| Edit profile                            | Yes   | Yes          | Yes                          |
| Manage links                            | Yes   | Yes          | Yes                          |
| Create events                           | Yes   | Yes          | Yes                          |
| Invite collaborator                     | Yes   | Yes          | Yes                          |
| Approve or reject collaborator requests | No    | No           | Yes                          |
| Transfer ownership                      | No    | No           | Yes (outside organizer flow) |

## 10. UX Quality Bar

1. Context-first UI: active community visible on every organizer page.
2. Consistent components: shared page header, cards, tables, and form controls.
3. Predictable states: loading, empty, success, and error states on every operation.
4. Mobile operability: all core actions must be complete on mobile without loss of function.
5. Reduced cognitive load: one primary purpose per page and no duplicate action paths.

## 11. Product Metrics

Primary metrics:

- organizer weekly active operators
- percent of organizers active in two or more communities
- median time from collaborator invite to active access
- events created per active community workspace

Guardrail metrics:

- context-mismatch action rate
- duplicate invite rate
- collaborator rejection rate

## 12. Rollout Plan

Phase 1: workspace and IA hardening

- canonical route map
- explicit context banner everywhere
- communities page consistency

Phase 2: collaborator workflow completion

- dedicated collaborators page
- full active and pending visibility
- invite lifecycle clarity

Phase 3: event operations completion

- events list for community organizers
- improved create-event confidence and result states

Phase 4: instrumentation and optimization

- complete analytics instrumentation
- identify and fix low-conversion states

## 13. Dependencies

- Claim flow and claim state semantics
- Admin moderation queue for collaborator requests
- Organizer email notifications for collaborator decisions
- Shared design system primitives for consistency

## 14. Open Product Decisions

1. Should collaborator removal be owner-only or owner plus collaborator?
2. Should approved collaborators require owner acknowledgment on first entry?
3. Should event edit/delete rights be fully symmetric between owner and collaborator?
4. Should communities page show SLA-style health badges in v1 or v1.1?

## 15. Spec Hand-off

This flow document is the product baseline. Implementation must proceed through a paired PRD and TDD.

- PRD: organizer workspace and collaborator lifecycle experience
- TDD: route contracts, context resolver, permission enforcement, and rollout controls
