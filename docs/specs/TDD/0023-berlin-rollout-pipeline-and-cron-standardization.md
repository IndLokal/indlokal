# TDD-0023: City onboarding baseline and metro-aware submission intake

- **Status:** Draft
- **Linked PRD:** PRD-0023
- **Owner:** Founders

## 1. Architecture overview

City onboarding should use a single canonical intake and storage path:

1. Submit city queries include active metros and satellites.
2. Submit validations accept both active metros and satellite rows.
3. Persisted target city is normalized to metro primary city ID.
4. Submitted city context is retained in metadata.
5. City page metadata uses configured city display names.

## 2. Data model changes

No schema migration required for this item.

Use existing city model fields:

- `isActive`
- `metroRegionId`
- `isMetroPrimary`

Store submitted city context in existing JSON metadata payload.

## 3. API surface

No new API endpoints.

Existing submit rails change behavior only:

| Surface                 | Behavior change                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| `/submit` server action | accepts active + satellite city slugs; normalizes to metro primary |
| submit module service   | same normalization and validation policy                           |

## 4. Mobile screens & navigation

No mobile navigation changes.

## 5. Push / Email / Inbox triggers

No trigger changes.

## 6. Feature flags

None added.

## 7. Observability

- Keep submitted city slug in metadata payload for audit.
- Keep normalized city slug in analytics property for `community_submitted`.

## 8. Failure modes & fallbacks

| Failure                      | Fallback                                     |
| ---------------------------- | -------------------------------------------- |
| Satellite city missing in DB | reject with existing city validation error   |
| Metro mapping missing        | fallback to submitted city ID (no data loss) |
| PostHog unavailable          | analytics no-op, submit path still succeeds  |

## 9. Test plan

- Unit:
  - submit city validation accepts active and satellite cities.
  - normalization logic maps satellites to metro primary city ID.
- Integration:
  - submit action persists normalized cityId and metadata city context.
- Regression:
  - city metadata generation uses configured names for known city slugs.

## 10. Rollout plan

1. Deploy with no flag (behavior-only change).
2. Validate submit flows for Berlin + one Berlin satellite.
3. Verify city metadata titles in staging.

## 11. Backout plan

1. Revert submit validator/query predicates to `isActive=true` only.
2. Keep metadata helper as no-risk fallback; revert if any SEO regression observed.
