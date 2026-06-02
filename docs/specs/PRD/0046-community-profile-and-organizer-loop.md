# PRD/TDD-0046: Community Profile and Organizer Edit Loop

Status: Draft
Owner: Product + Web
Date: 2026-06-02

## Problem

Community pages are the public trust surface, but organizers lacked some high-impact controls in one place (for example audience persona and logo quality), and the public page did not clearly bridge maintainers to edit actions.

## Goals

1. Improve public profile clarity for members (what this community is for, who it serves).
2. Improve organizer editing ergonomics for profile quality and maintenance rhythm.
3. Strengthen the public-to-organizer maintenance loop without changing auth model.
4. Allow practical organizer-led city maintenance with clear guardrails.

## Non-goals

1. No schema migration.
2. No new role model or claim lifecycle changes.
3. No channel-management redesign (existing /organizer/links stays primary).
4. No unrestricted unlimited city reassignment without controls.

## User Stories

1. As a newcomer, I want to quickly understand whether a community is relevant to me.
2. As an organizer/collaborator, I want obvious controls to keep the public profile complete.
3. As a maintainer viewing the public page, I want a direct path to edit profile content.
4. As a community leader, I want to correct city assignment quickly when operational reality changes.

## City Change Policy

1. Organizer city change is owner-governed (community leader / manager authority only).
2. Moves within the same metro region (metro <-> satellite under the same metro) are auto-approved.
3. All cross-region moves require platform admin approval.
4. Organizer UI uses searchable city selection behavior consistent with submit-community UX.

## Acceptance Criteria

1. Organizer profile form supports editing logo URL and persona segments.
2. Organizer profile view shows actionable profile readiness guidance.
3. Public community page shows persona labels when available.
4. Public page shows an edit shortcut for authorized maintainers.
5. Organizer profile includes city-change request UI with searchable city picker.
6. Same-metro city changes are auto-applied without admin queue.
7. Cross-region city changes are queued for admin review.
8. Admin claims area shows only pending city-change requests requiring moderation.
9. Typecheck remains clean.

## Success Signals

1. Increased share of communities with persona segments and logo URL.
2. Higher profile completeness percentage in organizer dashboard.
3. Reduced admin/manual edits for profile copy cleanup.
4. Lower admin moderation load for routine metro/satellite corrections.
5. Fewer organizer support requests for city correction turnaround.

## Rollout

1. Flag-free release (UI and existing update action only).
2. Verify with typecheck and organizer/public/admin smoke navigation.

## Risks

1. Weak logo URLs may reduce visual quality.
2. Persona values rely on organizer interpretation consistency.

## Backout

1. Revert form/public UI changes in affected files.
2. Existing data remains valid; no migration rollback needed.
