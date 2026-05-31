# Event and Community Dedup Guide

This guide explains how dedup works in plain language, with examples.

## Why this exists

We want to avoid creating duplicate records, but we must not merge two different real events or communities by mistake.

The system now uses a conservative approach:

- Strong exact signals first (URL matches)
- Then fuzzy signals (title/name similarity)
- Fuzzy match is accepted only when extra identity evidence is present

## 30-Second Visual Flow

Event flow

1. New pipeline item
2. If type is Event:
   1. Check source URL duplicate
   2. If match and title or date is close -> Duplicate found
   3. Else check registration URL exact match
   4. If match -> Duplicate found
   5. Else check title similarity
   6. If no similarity -> Not duplicate
   7. If similar, require identity evidence:
      1. Venue matches, or
      2. Host matches, or
      3. Start time is close
   8. If identity evidence exists -> Duplicate found
   9. Else -> Not duplicate

Community flow

1. If type is Community:
2. Check same-city name similarity
3. If high similarity -> Duplicate found
4. If borderline similarity -> Run semantic check on top five
5. If semantic match -> Duplicate found
6. Else check merged aliases and pending or reviewed queue
7. If match -> Duplicate found
8. Else -> Not duplicate

Final action

1. If duplicate found -> Mark duplicate or merge
2. If not duplicate -> Queue or create new

---

## Event dedup (how it works)

There are 2 checkpoints.

1. Queue-time dedup: during pipeline extraction/queueing.
2. Approval-time dedup: right before creating a real event row.

If approval-time finds a duplicate, no new event is created. The pipeline item is marked as `MERGED` and linked to the existing event.

### Event decision order

1. Source URL duplicate check

- If the normalized source URL matches a previously reviewed pipeline item in the same city, we treat it as duplicate.
- Safety check: title or date must also be close for source-URL match at approval-time.

2. Registration URL exact match

- If `registrationUrl` normalized matches an existing event in the same city and date window, it is duplicate.

3. Title similarity check (fuzzy)

- Title similarity threshold: `> 0.7`, or normalized-title exact match.
- This alone is NOT enough.

4. Identity evidence gate (required for title-based merge)
   At least one of these must be true:

- Venue names match after normalization
- Host/community names match after normalization
- Start times are within 2 hours

5. Date window gate

- Candidate events must be within +/- 1 day of extracted event date.

### Event examples

#### Example A: should merge (duplicate)

- City: Karlsruhe
- Title: "Grill Fest" and "Grill Fest 2026"
- Same date and same venue/community
- Different slugs

Result: duplicate (merged).
Reason: title similarity + identity evidence + close date.

#### Example B: should NOT merge (likely distinct)

- City: Munich
- Title: "Friendship Concert: No Road Too Far" appears twice
- Same date/time, but one row has different/no community and unclear venue evidence

Result: hold for manual review unless strong identity evidence confirms same event.
Reason: title/date alone can still be ambiguous.

#### Example C: should merge (strong)

- Same city
- Same registration URL after normalization

Result: duplicate immediately.
Reason: registration URL is treated as strong identity.

---

## Community dedup (how it works)

Community dedup runs during queue-time.

### Community thresholds

- Name similarity hard threshold: `0.72`
- Semantic borderline threshold: `0.35`

### Community decision order

1. Same-city candidate communities are compared.
2. If name similarity >= 0.72 -> duplicate.
3. If similarity is between 0.35 and 0.72 -> semantic duplicate check runs on top candidates.
4. Also check merged aliases (old names that were merged before).
5. Also check pending/reviewed pipeline community items to avoid queue duplicates.

### Community examples

#### Example D: should merge

- "Tamil Sangam Stuttgart e.V." vs "Tamil Sangam Stuttgart"
- Same city
- Name similarity high after normalization

Result: duplicate.

#### Example E: should NOT merge

- "Indian Professionals Munich" vs "Indian Parents Munich"
- Same city but different purpose/group

Result: not duplicate if similarity and semantic check are weak.

---

## Current parameter values

### Events

- Title similarity threshold: `0.7`
- Identity time tolerance: `<= 2 hours`
- Date candidate window: `+/- 1 day`
- Source URL recent scan limit: `300` pipeline items
- Queue statuses checked for duplicate references: `PENDING`, `APPROVED`, `MERGED`

### Communities

- Name duplicate threshold: `0.72`
- Semantic borderline threshold: `0.35`
- Borderline semantic candidates checked: up to `5`
- Queue statuses checked: `PENDING`, `APPROVED`, `MERGED`

---

## Rejection memory (don't re-queue rejected items)

Older runs only looked at `PENDING`, `APPROVED`, and `MERGED` items. Anything an
admin **rejected** was invisible to the next run, so the same source kept coming
back day after day. We now keep a "rejection memory":

- Before queuing a new item, we check the `REJECTED` history for the same city.
- An event is suppressed if the **source URL** matches a rejected item, OR if the
  **title matches AND there is strong identity evidence** (venue/host/time) within
  the date window.
- A community is suppressed if the **source URL** matches a rejected item, OR the
  **normalized name matches**.
- Suppressed items are dropped (not queued) and logged as
  `Skipped (previously rejected: <reason>)`.

This is deliberately strict: a rejection is a strong human signal, but we still
require an exact URL or a full identity/name match so an unrelated new item is
never suppressed by a coincidental past rejection.

## Merged communities (don't re-queue after a merge)

When community A is merged into community B, A's name is kept as an **alias**
(`mergedIntoId` set). Queue-time dedup compares incoming names against these
aliases, so a later run that rediscovers "A" maps straight to the canonical B
instead of creating a new community.

---

## Practical guidance for admins

When you see two very similar events in admin:

1. Compare registration URL first.
2. Compare venue and host community.
3. Compare start time.
4. If still ambiguous, do not auto-merge. Keep manual review.

This is intentional. False merge is worse than temporary duplicate.

---

## Code locations

- Shared dedup primitives (single source of truth — thresholds, normalization,
  similarity, identity-evidence gate, rejection lookups):
  `apps/web/src/modules/pipeline/dedup.ts`
- Approval-time event dedup: `apps/web/src/modules/pipeline/review.ts`
- Queue-time dedup + rejection suppression (event + community):
  `apps/web/src/modules/pipeline/orchestrator.ts`
