# PRD-0023: City onboarding baseline and metro-aware submission intake

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0023, PRD/TDD-0013, PRODUCT_DOCUMENT.md, SOLUTION_ARCHITECTURE.md

## 1. Problem

As we prepare repeatable city onboarding (Berlin now, NRW next), submission intake and city partitioning must follow one explicit baseline:

- active metro cities and their satellites are both discoverable intake targets,
- ingestion partitions remain canonical at metro-primary level,
- and city metadata remains human-readable and stable for SEO/UX.

Without this baseline, onboarding additional regions creates inconsistent city handling across submit, pipeline review, and analytics.

## 2. Users & JTBD

- **Ops owner/founder:** needs reliable, repeatable city/region rollout playbook.
- **Admin reviewer:** needs cleaner queue relevance when running scoped shards.
- **Engineering team:** needs low-complexity extension path for next region onboarding.

## 3. Success Metrics

- Submit rails accept both active metro cities and configured satellites.
- Submissions from satellites are normalized to metro-primary city partition.
- City metadata and titles use configured display names (not slug capitalization fallbacks).
- No new city-scope primitives are introduced in this phase.

## 4. Scope

- Expand submission city selectors and validators to include active metros + satellites.
- Normalize accepted satellite submissions to metro-primary city IDs.
- Preserve submitted city context in metadata for auditability.
- Use configured city display names in city-level metadata generation.

## 5. Out of Scope

- Pipeline scope strategy changes.
- Cron scheduler changes.
- NRW source curation itself.
- New auth/permissions changes.

## 6. User Stories

- As a submitter in a Berlin satellite city, I can submit through the same flow as a metro user.
- As an admin, I see intake and queue items assigned to the canonical metro partition.
- As an engineer, I can reuse the same city onboarding pattern for NRW without new city primitives.

## 7. Acceptance Criteria (Gherkin)

```text
Given a pipeline cron call with ?region=berlin
Given a submit request for a metro satellite city
When validation succeeds
Then the submission is accepted
And normalized to the metro primary city partition.

Given a city page metadata render for a configured city slug
When metadata is generated
Then configured city display name is used instead of slug formatting fallback.
```

## 8. UX

- No net-new surfaces.
- Submit city picker includes satellite options with clear metro context labels.
- Existing admin/pipeline screens remain unchanged.

## 9. Risks & Open Questions

- Satellite-to-metro normalization could hide exact submit city context unless preserved in metadata.
- Region onboarding still requires disciplined source curation; this PRD only standardizes intake mechanics.
