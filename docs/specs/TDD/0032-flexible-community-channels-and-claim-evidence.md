# TDD-0032: Flexible community channels and claim evidence capture

- **Status:** Draft
- **Linked PRD:** PRD-0032
- **Owner:** Founders

## 1. Architecture overview

Surfaces touched:

1. Web submission form and action:
   - `apps/web/src/app/submit/SubmitForm.tsx`
   - `apps/web/src/app/submit/actions.ts`
   - `apps/web/src/lib/validation.ts`
2. Claim flow:
   - `apps/web/src/app/[city]/communities/[slug]/ClaimSection.tsx`
   - `apps/web/src/app/[city]/communities/[slug]/actions.ts`
   - `apps/web/src/lib/validation.ts`
3. API contract and service path:
   - `packages/shared/src/contracts/submit.ts`
   - `apps/web/src/modules/submit/service.ts`
   - `apps/web/src/app/api/v1/submissions/community/route.ts`
4. Outreach promotion flow:
   - `apps/web/src/app/admin/(dashboard)/outreach/actions.ts`

## 2. Data model changes

No Prisma migration required for Phase 1.

Phase 2 claim evidence model change (metadata shape only):

- Current:
  - `metadata.claimRequest.whatsappUrl`
  - `metadata.claimRequest.telegramUrl`
  - `metadata.claimRequest.socialUrl`
- Proposed:
  - `metadata.claimRequest.evidenceLinks: Array<{ type: string; url: string }>`

Backward compatibility:

- Read both old and new claim metadata during transition.

## 3. API and contract changes

### 3.1 Shared contract (`@indlokal/shared`)

`CommunitySubmission` should accept:

- `channels: ChannelSubmission[]` (new canonical)
- legacy `primaryChannelType/Url` + `secondaryChannelType/Url` during transition window

Validation rules:

- `channels.length` in [1..6]
- exactly one primary channel
- no duplicate `(channelType, normalizedUrl)` pairs

### 3.2 Web server actions

- `submitCommunity` should parse repeater channels and store all channels.
- Keep legacy field parsing behind compatibility fallback until frontend migration completes.

### 3.3 Claim action

- `claimCommunity` to parse evidence repeater links and write array to metadata.

## 4. UI behavior

### 4.1 Submission form

- Channel repeater rows with:
  - channel type select
  - URL input
  - optional label
  - primary toggle/radio
  - remove action
- Start with one row by default.
- "Add channel" button appends row up to cap.

### 4.2 Claim form

- Proof-of-connection repeater rows replacing three fixed fields.
- Keep optional; at least 0 entries allowed.
- Evidence type select options are unique across rows (selected type removed from remaining selectors).

### 4.3 Admin review

- `admin/(dashboard)/submissions/page.tsx` should render all submitted channels (already list-based).
- `admin/(dashboard)/claims/page.tsx` should render evidence links array with fallback to old fields.

## 5. Failure modes and fallbacks

- Malformed channel payload from client:
  - reject with field-level error, preserve entered rows.
- Legacy API clients still sending old fields:
  - accepted during transition; transformed into canonical channels array.
- Multiple primary channels submitted:
  - server rejects with explicit error.
- Duplicate links:
  - server rejects with duplicate error.
- Duplicate claim evidence types in UI state:
  - prevent via selector option filtering; server still validates and rejects if malformed payload bypasses UI.

## 6. Observability

Track events:

- `submission_channels_count`
- `claim_evidence_links_count`
- validation error classes (`duplicate_channel`, `missing_primary`, `invalid_url`)

Admin metrics:

- % submissions with >2 channels
- claim approval SLA before/after evidence repeater

## 7. Test plan

- Unit:
  - channel normalization and duplicate detection
  - exactly-one-primary validation
  - backward compatibility parser for legacy fields
  - evidence type uniqueness validator
- Integration:
  - web submit with 1, 2, 6 channels
  - API submit with new channels array and legacy fields
  - claim submit with N evidence links
- E2E:
  - add/remove channel rows UX in submit form
  - add/remove evidence rows UX in claim form

## 8. Rollout plan

1. Add canonical schema + compatibility parser (server first).
2. Ship submit form repeater UI.
3. Ship claim evidence repeater UI.
4. Ship outreach promote optional channel input.
5. Remove legacy parser after clients are migrated.

## 9. Backout plan

- Keep legacy primary/secondary fields parser active.
- Hide repeater UI behind a feature flag and revert to fixed fields if needed.
- Preserve stored channel rows; no destructive migration required.
