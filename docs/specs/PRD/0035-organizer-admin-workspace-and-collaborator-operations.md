# PRD-0035: Organizer admin workspace and collaborator operations

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead, Design
- **Linked:** TDD-0035, PRD-0017, PRD-0034, [COMMUNITY_ORGANIZER_ADMIN_FLOW.md](../../COMMUNITY_ORGANIZER_ADMIN_FLOW.md)

## 1. Problem

The current organizer product does not operate as a reliable workspace system.

Three failures block healthy organizer adoption:

1. Multi-community ambiguity

- Users who manage more than one community do not have a sufficiently explicit workspace model.
- Core actions can feel detached from active context, increasing the risk of wrong-community edits.

2. Collaborator workflow incompleteness

- Collaborator access exists conceptually, but organizer experience does not yet behave like a full team-management product.
- Owners and collaborators lack a complete view of pending, active, and moderated team state.

3. Weak operational structure

- Profile, links, collaborators, and events do not yet form a clean operating loop.
- The product feels fragmented instead of like a coherent admin console.

This matters now because claimed communities are starting to behave like teams rather than single-user pages. The organizer surface must support that operating model before broader rollout.

## 2. Users & JTBD

- **Primary owner:** I need a reliable workspace to manage my community and safely delegate work.
- **Collaborator:** I need predictable access to help manage a claimed community without ambiguity.
- **Multi-community operator:** I need to switch between communities quickly and confidently.
- **Platform admin:** I need low-friction moderation of collaborator requests without complex RBAC overhead.

## 3. Success Metrics

- ≥ 95% of organizer page loads show a valid active community context.
- Median time from collaborator invite to active access < 48h.
- < 1% organizer action submissions require support correction due to wrong-community context.
- ≥ 30% of eligible multi-community organizers use workspace switching within 30 days.
- ≥ 70% of approved collaborator invites result in first organizer session within 7 days.

Analytics to define/use:

- `organizer_workspace_opened`
- `organizer_workspace_switched`
- `organizer_collaborator_invited`
- `organizer_collaborator_request_submitted`
- `organizer_collaborator_request_approved`
- `organizer_event_created`
- `organizer_context_mismatch_blocked`

## 4. Scope

In scope:

- Canonical organizer workspace model with one active community at a time.
- Organizer IA with dedicated routes for Overview, Communities, Profile, Links, Collaborators, and Events.
- Dedicated collaborator management page for active community.
- Community-scoped events list and create flows.
- Backward-compatible redirects from legacy organizer routes.
- Clear role display for owner vs collaborator.
- Admin-moderated collaborator request lifecycle integrated into organizer experience.

## 5. Out of Scope

- Fine-grained collaborator roles and permissions.
- Self-serve ownership transfer.
- Billing, seats, or organization subscriptions.
- Independent event host product redesign.
- Advanced analytics dashboards for organizers.
- File/media upload redesign.

## 6. User Stories

- As a multi-community organizer, I want to see and switch my active community clearly so that I never edit the wrong page.
- As a primary owner, I want a dedicated collaborators page so that I can manage my team from one place.
- As a collaborator, I want clear status and access expectations so that I understand when I can operate the workspace.
- As an organizer, I want an events page for my current community so that event operations feel part of the same product.
- As an admin, I want collaborator requests to remain safe and reviewable so that team growth does not create governance risk.

## 7. Acceptance Criteria (Gherkin)

```gherkin
Given a user with access to communities A and B
When they open any organizer workspace page
Then the active community is explicitly shown in the UI
And all content and actions are scoped to that same community
```

```gherkin
Given a user switches from community A to community B
When the switch completes
Then the organizer header and page content both reflect community B
And subsequent actions operate only on community B
```

```gherkin
Given a claimed community with collaborators enabled
When an owner opens the collaborators page
Then they see the owner block, active collaborators, pending requests, and invite form
```

```gherkin
Given an organizer submits a collaborator invite for an existing active collaborator
When the request is processed
Then the product returns idempotent success feedback
And no duplicate active membership is created
```

```gherkin
Given an organizer opens the events page
When the active community has events
Then the product shows upcoming and past sections for that community only
```

## 8. UX

Screens:

- Organizer overview
- Communities index / switcher
- Profile editor
- Community links manager
- Collaborators management page
- Events list page
- New event page

Required UX behavior:

- Active workspace banner on every organizer page.
- Owner/collaborator role label visible in relevant views.
- Empty states for no collaborators, no pending requests, and no events.
- Mobile-safe navigation for workspace switching and critical actions.
- Clear copy for moderation path: collaborator invites and access requests are reviewed by admin.

State requirements:

- Loading: stable skeleton or reserved layout, no context flicker.
- Success: inline confirmation on save/invite/create.
- Error: actionable inline errors per field or operation.
- Empty: task-oriented next-step guidance.

Accessibility:

- Role/status not conveyed by color alone.
- Switcher, tabs, and buttons keyboard reachable.
- Form feedback announced clearly for assistive tech.

## 9. Risks & Open Questions

Risks:

- Overloading the organizer shell with too many parallel navigation concepts.
- Confusion if collaborator powers feel identical to owner without enough role labeling.
- Team-management expectations growing faster than v1 permission model supports.

Open questions:

- Should collaborator removal be owner-only or also available to collaborators?
- Should we expose “pending since” SLA nudges on collaborator requests?
- Should event edit/delete be included in this same milestone or deferred?
