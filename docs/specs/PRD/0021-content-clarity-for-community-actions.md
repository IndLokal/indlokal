# PRD-0021: Content clarity for community actions

- **Status:** Draft
- **Owner:** Content / Product
- **Reviewers:** Eng Lead, Design, Community Ops
- **Linked:** TDD-0021

## 1. Problem

Users land on IndLokal and immediately see actions like **suggest a community**, **claim a community**, **submit a community**, and **organizer login/dashboard**. The current product already exposes these flows, but the meaning of each action is too implicit. Visitors do not always know:

- what an organizer is,
- whether they should claim or suggest,
- what happens after claiming,
- what the organizer dashboard is for,
- and whether “submit” means adding something new or managing something existing.

This creates hesitation at the exact moment we want users to participate. It also makes the same concepts appear with slightly different wording across web and mobile surfaces.

## 2. Users & JTBD

- First-time visitor in Germany who wants to understand how IndLokal works.
- Community member who knows a group or resource and wants to add it.
- Organizer/founder/admin who already runs a community and wants control of the listing.
- Existing organizer who wants to understand what the dashboard lets them do.

JTBD:

- As a visitor, I want a simple explanation of the available actions so I can choose the right one quickly.
- As an organizer, I want to know what claiming unlocks so I understand why I should request ownership.
- As a community member, I want to know when I should suggest vs submit so I do not duplicate the wrong flow.

## 3. Success Metrics

- Increase click-through from explanatory surfaces to the intended action links.
- Reduce drop-off on claim/suggest/submit pages.
- Reduce support questions and ambiguous internal feedback about the difference between claim, suggest, submit, and organizer login.
- Primary analytics events should track clicks on the action explainer CTAs and completion of the downstream forms.

## 4. Scope

- Add a shared plain-language action explainer that defines:
  - what a community organizer is,
  - what claiming a community means,
  - what suggesting a community means,
  - what submitting a community means,
  - what the organizer dashboard is for.
- Reuse that explainer on the main About page and the relevant city/community entry points.
- Tighten CTA labels and helper copy so each flow is self-explanatory.
- Keep the tone factual, friendly, and non-technical.

## 5. Out of Scope

- No new backend workflows.
- No auth or permission changes.
- No schema changes.
- No new onboarding wizard or multi-step education flow.
- No redesign of the full marketing site.

## 6. User Stories

- As a visitor, I want one place that tells me what each action does so I do not have to guess.
- As an organizer, I want the “claim” flow to explain the benefit of ownership before I start the form.
- As a community member, I want “suggest” to clearly mean “this is missing from the directory”.
- As an organizer, I want the dashboard to describe the tasks I can do there before I log in.

## 7. Acceptance Criteria (Gherkin)

```text
Given a first-time visitor
When they open the About page or a city/community entry page
Then they can see a short explanation of organizer, claim, suggest, submit, and dashboard in plain language

Given a visitor who wants to add a missing listing
When they open the suggest flow
Then the page clearly states that suggest is for missing communities or resources and does not require ownership

Given an organizer who manages a listed community
When they open the community page
Then the claim section explains what claiming unlocks before the form is expanded

Given an approved organizer
When they open the organizer dashboard
Then the page explains what they can do there: edit profile, manage channels, and add events
```

## 8. UX

Primary surfaces:

- About page
- City suggest page
- Community detail page claim section
- Organizer dashboard
- Web submit form
- Mobile submit suggest/community screens if copy parity is needed

Copy principles:

- Use short noun-first labels.
- Make the first sentence say who the action is for.
- Make the second sentence say what happens next.
- Avoid jargon like “supply-side” or “RBAC” in user-facing text.
- Distinguish between “suggest” and “claim” explicitly.

Recommended content shape:

- A compact action explainer grid with 4-5 cards.
- Each card should include: audience, action, outcome, and primary CTA.
- Add a small “Who should use this?” line on pages with ambiguous actions.

## 9. Risks & Open Questions

- Too much explanation could crowd the pages if the cards are verbose.
- We need to keep the wording aligned across web and mobile without creating duplicated content in many files.
- If analytics are added later, the cards should have stable identifiers for event tracking.
