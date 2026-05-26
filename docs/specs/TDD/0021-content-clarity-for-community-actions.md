# TDD-0021: Content clarity for community actions

- **Status:** Draft
- **Linked PRD:** PRD-0021
- **Owner:** Eng

## 1. Architecture overview

Implement a small shared content layer for user-facing action explanations. The layer should expose the canonical wording for:

- organizer,
- claim a community,
- suggest a community,
- submit a community,
- organizer dashboard.

The shared copy is then rendered through lightweight presentational components on existing web and mobile screens. This keeps wording consistent without adding backend complexity.

Proposed implementation surface:

- `packages/shared/src/content/community-actions.ts` for canonical copy and interpolation helpers.
- `apps/web/src/components/content/community-actions.tsx` for reusable explainer UI.
- Existing route pages import copy from `@indlokal/shared` and render it in context.
- Mobile submit screens import copy from `@indlokal/shared` for parity.
- No backend or schema changes.

## 2. Data model changes

None.

## 3. API surface

None.

## 4. Mobile screens & navigation

No navigation changes. Mobile parity is included in this implementation by consuming the shared copy map in existing Expo submit routes.

## 5. Push / Email / Inbox triggers

None.

## 6. Feature flags

None.

## 7. Observability

No new runtime telemetry required. If analytics are later added, the explainer CTA links should use stable labels so click tracking can be added without changing copy.

## 8. Failure modes & fallbacks

- If the shared content component fails to render, the page should still show the existing page content and CTA links.
- Copy should remain understandable even without the shared component by keeping the fallback text in the route files minimal and explicit.

## 9. Test plan

- Unit: verify the shared content component renders the expected action labels and descriptions.
- Unit: verify shared copy registry exports stable identifiers and supports city-name interpolation.
- Web smoke: open About, suggest, submit, claim section, organizer login, and organizer dashboard pages and confirm the explainer section is visible.
- Mobile smoke: open submit chooser, submit community, and suggest screens and confirm helper text matches shared copy.
- No contract or backend tests required.

## 10. Rollout plan

- Ship directly in one patch affecting shared + web + mobile.
- Verify shared, web, and mobile TypeScript typechecks.

## 11. Backout plan

- Remove the shared component import and revert the route copy to the previous inline text.
- No data migration or backend rollback is needed.
