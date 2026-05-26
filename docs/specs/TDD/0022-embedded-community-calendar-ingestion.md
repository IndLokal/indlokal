# TDD-0022: Embedded community calendar ingestion

- **Status:** Draft
- **Linked PRD:** PRD-0022
- **Owner:** Founders

## 1. Architecture overview

Add a deterministic feed path alongside existing pipeline extraction:

1. Fetch pinned community URL HTML.
2. Detect embedded Google Calendar iframe URLs.
3. Extract calendar IDs from `src` query params.
4. Classify IDs (`org_events` vs `holiday_overlay`).
5. Resolve IDs to public ICS URLs.
6. Parse ICS VEVENTs to normalized event records.
7. Upsert events idempotently in pending approval state and attach source metadata.

This path runs before LLM extraction for known embedded-calendar sources.
Holiday overlay calendars are filtered out and never persisted.

## 2. Data model changes

No blocking schema change required for v1 if source metadata fits current event
fields plus existing trust/provenance structures.

If needed, add minimal source provenance fields in a follow-up migration:

- `sourceCalendarId` (string)
- `sourceEventUid` (string)
- `sourceKind` (`ORG_EVENTS`)

Recommended unique index:

- `(communityId, sourceCalendarId, sourceEventUid)`

## 3. API surface

No public API contract change in v1.

Internal/admin capabilities:

| Method | Path                              | Auth  | Request                     | Response                      |
| ------ | --------------------------------- | ----- | --------------------------- | ----------------------------- |
| POST   | /admin/pipeline/sync-known-source | ADMIN | `communityId` or source key | per-source sync summary       |
| GET    | /admin/pipeline/source-health     | ADMIN | source filters              | last success/failure + counts |

## 4. Mobile screens & navigation

No mobile route changes required.

## 5. Push / Email / Inbox triggers

Existing event notification logic applies to newly ingested events.
No new trigger types in v1.
Notifications must only trigger after admin approval.

## 6. Feature flags

- `PIPELINE_ENABLE_EMBEDDED_CALENDAR_INGEST=1` (default off for safe rollout)
- `PIPELINE_CALENDAR_SYNC_CRON=monthly` (default)
- `PIPELINE_CALENDAR_EXPANSION_DAYS=180` (default)

Kill switch: disable the first flag to fully bypass new ingestion path.

## 7. Observability

Per run, emit:

- `calendar_sources_detected`
- `calendar_feeds_resolved`
- `calendar_events_parsed`
- `calendar_events_upserted`
- `calendar_events_duplicates_skipped`
- `calendar_feed_failures`
- `calendar_events_pending_approval`

Structured logs should include: `communityId`, `sourceUrl`, `calendarId`,
`feedUrl`, `errorType`.

## 8. Failure modes & fallbacks

| Failure                   | Fallback                                          |
| ------------------------- | ------------------------------------------------- |
| iframe not found          | continue with current generic pipeline extraction |
| feed URL inaccessible     | log source failure, skip source, continue run     |
| malformed ICS item        | skip bad item, continue feed                      |
| recurrence explosion      | enforce bounded expansion window                  |
| duplicate source events   | unique upsert key prevents duplicate inserts      |
| holiday calendar detected | classify and skip, no storage                     |

## 9. Test plan

- Unit:
  - iframe parser extracts calendar IDs from embed URL.
  - calendar classifier separates org vs holiday IDs and drops holidays.
  - ICS parser maps all-day vs timed events and timezone behavior.
  - upsert key deduplicates repeated syncs.
  - ingestion status defaults to pending approval.
- Contract (OpenAPI schema):
  - internal admin sync-health route response schemas.
- E2E:
  - known source sync creates events for unclaimed community.
  - repeated sync is idempotent.
  - holiday overlay is never stored.
  - imported events are not public until admin approves.
- Load:
  - simulate recurrence-heavy feed and verify bounded runtime.

## 10. Rollout plan

1. Ship behind flag with one pilot source (MMS).
2. Run monthly sync in pilot and verify approval workflow + idempotency.
3. Enable for Stuttgart known sources.
4. Expand city-by-city.

## 11. Backout plan

1. Disable `PIPELINE_ENABLE_EMBEDDED_CALENDAR_INGEST`.
2. Re-run pipeline with existing generic path.
3. If needed, soft-hide source-tagged events from this path until fixed.
