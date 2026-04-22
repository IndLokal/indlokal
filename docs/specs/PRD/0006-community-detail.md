# PRD-0006: Community detail (follow, channels, related)

- **Status:** Draft
- **Owner:** PM
- **Reviewers:** Mobile lead, Design

## 1. Problem

Mirror web `/[city]/communities/[slug]` so users can decide to follow and reach the community via its preferred channel (WhatsApp, Telegram, website, etc.).

## 2. Users & JTBD

- "Find a real, active community and contact it the way they actually use."

## 3. Success Metrics

- Follow rate ≥ 15 % of detail views.
- AccessChannel tap-through ≥ 30 %.

## 4. Scope

- Header: cover image, logo, name, city, categories, badges (Verified, Claimed, Trending), Pulse Score breakdown link.
- Actions: **Follow**, **Share**, **Report**.
- AccessChannels list — primary on top, channel-typed icons.
- Upcoming events (uses TDD-0005 cards).
- Related communities (`RelationshipEdge`).

## 5. Out of Scope

- In-app messaging.
- Editing (organizer surface — Phase 2 mobile).

## 6. User Stories

- As a user I tap WhatsApp and the channel opens in the WhatsApp app.
- As a user following a community I get notified for new events from it (gated by prefs).

## 7. Acceptance Criteria

```
Given a user follows a community
When that community publishes a new event
Then a push notification is enqueued (topic=COMMUNITY_UPDATE) subject to caps and prefs
```

## 8. UX

Empty state for unverified communities; CTA "Know who runs this? Claim it" linking to web claim flow (mobile claim is Phase 2).

## 9. Risks & Open Questions

- Channel verification freshness — show `lastVerifiedAt` chip when stale (>90 d).
