/**
 * Journey Layer contracts — PRD/TDD-0052, ADR-0011.
 *
 * A Journey is a *composition* over existing tagged data (resources by
 * audience×stage, communities by personaSegment, events), shaped into a
 * stage-ordered, action-ending experience for a person navigating a
 * transition (student / family / professional / …).
 *
 * These schemas are the source of truth for `GET /api/v1/cities/:slug/journey`.
 * Per ADR-0002 the OpenAPI document is generated from them. Enums that already
 * exist (`ResourceAudience`, `ResourceStage`) are reused, never redefined.
 */

import { z } from 'zod';
import { ResourceStage } from './resources';

// ─── Persona ───────────────────────────────────────────────────────────────
//
// The public, URL-facing vocabulary. Each persona maps internally to one or
// more `ResourceAudience` values and community `personaSegment`s (see
// apps/web/src/modules/journeys/personas.ts). Keep these slugs stable — they
// become canonical SEO URLs.

export const JourneyPersona = z.enum([
  'STUDENT',
  'PROFESSIONAL',
  'FAMILY',
  'SKILLED_WORKER',
  'FOUNDER',
  'BUSINESS',
]);
export type JourneyPersona = z.infer<typeof JourneyPersona>;

// ─── Action descriptor (action-or-drop invariant) ──────────────────────────

export const JourneyActionKind = z.enum(['join', 'open_link', 'save', 'calendar', 'checklist']);
export type JourneyActionKind = z.infer<typeof JourneyActionKind>;

export const JourneyActionDescriptor = z.object({
  kind: JourneyActionKind,
  label: z.string(),
  /** Canonical Phase-1 detail URL or an official external link. Null only for
   *  synthetic checklist steps. */
  href: z.string().nullable(),
  /** True when `href` points off-platform (official site). */
  external: z.boolean().default(false),
});
export type JourneyActionDescriptor = z.infer<typeof JourneyActionDescriptor>;

// ─── Block ──────────────────────────────────────────────────────────────────

export const JourneyEntityKind = z.enum([
  'resource',
  'community',
  'event',
  'checklist',
  'ecosystem',
]);
export type JourneyEntityKind = z.infer<typeof JourneyEntityKind>;

export const JourneyBlock = z.object({
  entityKind: JourneyEntityKind,
  /** Null for synthetic checklist steps. */
  entityId: z.string().nullable(),
  title: z.string(),
  summary: z.string().nullable(),
  /** Small contextual hint, e.g. resource category or "Verified community". */
  badge: z.string().nullable(),
  /** Which scope tier matched (resources only): CITY / METRO / STATE / … */
  resolvedScope: z.string().nullable(),
  /** INVARIANT: always present. A block with no resolvable action is dropped
   *  during composition (ADR-0011 §3, action-or-drop). */
  action: JourneyActionDescriptor,
});
export type JourneyBlock = z.infer<typeof JourneyBlock>;

// ─── Stage grouping ──────────────────────────────────────────────────────────

export const JourneyStageBlock = z.object({
  stage: ResourceStage,
  stageIndex: z.number().int(),
  blocks: z.array(JourneyBlock),
});
export type JourneyStageBlock = z.infer<typeof JourneyStageBlock>;

// ─── JourneyView (response) ──────────────────────────────────────────────────

export const JourneyView = z.object({
  persona: JourneyPersona,
  /** URL-facing persona slug, e.g. "young-family". */
  personaSlug: z.string(),
  citySlug: z.string(),
  cityName: z.string(),
  language: z.string().default('en'),
  /** Cleared the minimum-density gate → safe to advertise as an entry point. */
  promoted: z.boolean(),
  /** Canonical order, empty stages omitted (collapsed). */
  stages: z.array(JourneyStageBlock),
  blockCount: z.number().int(),
});
export type JourneyView = z.infer<typeof JourneyView>;
