# PRD-0022: Embedded community calendar ingestion

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0022, AI_PIPELINE_PRODUCT.md, AI_PIPELINE_ARCHITECTURE.md

## 1. Problem

Some known communities do not publish event pages. They publish events only
through embedded calendars (for example Google Calendar iframe on homepage).
The current pipeline treats these mostly as unstructured webpage text, which is
lossy and can miss dates, recurrence, and updates.

We need a deterministic ingestion path for known communities where events are
available as machine-readable calendar feeds.

## 2. Users & JTBD

- **Platform admin / founder**: when onboarding a known-but-unclaimed
  community, wants event ingestion to start immediately without waiting for
  ownership claim.
- **End user**: wants accurate upcoming events and fewer stale or duplicate
  entries.
- **Ops owner**: wants predictable sync behavior and clear failure visibility.

## 3. Success Metrics

- For onboarded embedded-calendar communities, monthly sync job success rate >= 99%.
- > = 95% of parsed events from feed are ingested without manual correction.
- Duplicate insert rate (same source event) < 1% per sync run.
- 100% of ingested events go through admin approval before publish.

## 4. Scope

- Add a source strategy for known embedded calendars.
- Detect calendar embeds on pinned community URLs and extract calendar IDs.
- Resolve calendar IDs to feed URLs and ingest events from feeds.
- Ingest community-owned calendar events as primary events.
- Exclude holiday calendars from ingestion and storage.
- Make ingestion independent of claim state (`UNCLAIMED` allowed).
- Add idempotent upsert keys based on source calendar ID + source event UID.
- Run calendar feed reads on a monthly cadence by default.
- Route all ingested events to admin approval queue before publishing.

## 5. Out of Scope

- Generic support for every calendar vendor in v1 (Google-first only).
- Holiday overlay ingestion/storage.
- UI redesign of calendar/event pages.
- Changing community ownership/claim workflows.
- Replacing existing pipeline extraction for non-calendar sources.

## 6. User Stories

- As an admin, I can onboard a known community with embedded calendar and start
  sync even if the community is unclaimed.
- As an admin, I can review all imported calendar events before they are live.
- As a user, I see upcoming community events with correct dates and times.
- As an operator, I can see feed-level failures and retry without duplicates.

## 7. Acceptance Criteria

```
Given a known community website with an embedded Google Calendar iframe
When the pipeline processes that source
Then it extracts calendar IDs and resolves at least one feed URL.

Given the feed contains VEVENT items with UID
When ingestion runs repeatedly
Then the same source event is upserted idempotently (no duplicate records).

Given the community is UNCLAIMED
When feed ingestion runs
Then events are still ingested and linked to that community.

Given the embed includes both org and holiday calendars
When ingestion classifies sources
Then org calendar events are ingested as primary events
 And holiday calendars are ignored and never stored.

Given events are parsed successfully from a calendar feed
When they are written to the system
Then they are created in pending approval state
 And are not publicly visible until approved by an admin.

Given calendar sync is configured for known sources
When the scheduler runs
Then calendar reads execute on a monthly cadence.

Given feed parsing fails for one source
When the sync job completes
Then the failure is logged with source/community context
 And other sources continue processing.
```

## 8. UX

- Admin data flow:
  - Community source metadata should show detected calendar IDs.
  - Ingested items should appear in the admin approval queue with calendar
    source metadata.
- No end-user UX changes required in v1.
- Error state copy in admin should identify source URL/feed URL and last failure.

## 9. Risks & Open Questions

- **Risk:** Feed ACL/privacy changes can silently break ingestion.
  - Mitigation: alert on repeated source-level failures.
- **Risk:** Recurrence expansion can inflate event volume.
  - Mitigation: bounded expansion window (for example next 180 days).
- **Decision:** holiday overlays are not ingested or stored in v1.
- **Decision:** auto-publish is disabled; admin approval is mandatory for all
  calendar-ingested events.
