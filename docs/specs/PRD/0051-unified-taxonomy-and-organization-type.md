# PRD-0051: Unified taxonomy + organization type

- **Status:** Implemented
- **Owner:** Product
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0051, ADR-0010, PRD/TDD-0048

## 1. Problem

`Community` is overloaded — it represents informal groups, registered associations, temples,
institutions, and (eventually) businesses, with no way to tell them apart. Persona/audience/language
vocabularies are split across models (`personaSegments`, `ResourceAudience`, `languages[]`), causing
drift and blocking unified search facets + a future AI concierge.

## 2. Users & JTBD

- **User filtering search:** "show me student groups" vs "temples" vs "professional associations".
- **Operators / pipeline:** classify supply consistently.
- **Future concierge:** needs one taxonomy to reason over.

## 3. Success Metrics

- `organizationType` populated on ≥ 80% of ACTIVE communities after backfill heuristics + admin edits.
- Single shared taxonomy module imported by web forms, pipeline, and search (no inline enums added).

## 4. Scope

- Add `OrganizationType` enum + `Community.organizationType` (nullable, additive migration).
- Centralize persona/audience/language/organizationType taxonomy in `@indlokal/shared`.
- Expose `organizationType` in the organizer profile form + admin community import/edit.
- Heuristic backfill from existing categories/persona/name keywords (best-effort, reversible).

## 5. Out of Scope

- Sponsor/collaboration-readiness fields (deferred per ADR-0010).
- A separate `Organization` model.
- Search facet UI (lands incrementally; field is available to ranking immediately).

## 6. User Stories

- As an organizer I can declare what kind of organization my community is.
- As an operator I can filter/sort communities by organization type.

## 7. Acceptance Criteria (Gherkin)

```
Given the migration is applied
When I create or edit a community
Then I can set organizationType to one of the shared enum values

Given existing communities
When the backfill runs
Then communities with a clear signal (temple/student/association) receive a best-effort organizationType
```

## 8. UX

Organizer profile form gets an "Organization type" select. Admin community edit/import accepts the field.
Public surfaces may show a small type label (additive, non-blocking).

## 9. Risks & Open Questions

- Heuristic backfill may misclassify — keep nullable and editable; never overwrite a human-set value.
