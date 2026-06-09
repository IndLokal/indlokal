/**
 * Persona definitions and mapping — PRD/TDD-0052, ADR-0011 §4.
 *
 * A persona is the public, URL-facing identity a visitor *selects* (never
 * inferred). Each maps deterministically onto the existing tag vocabulary:
 *   - `audiences`        → `Resource.audiences[]` (ResourceAudience)
 *   - `personaSegments`  → `Community.personaSegments[]`
 *
 * Persona slugs are canonical SEO URLs — keep them stable.
 */
import type { JourneyPersona, ResourceAudience } from './types';

export interface PersonaDefinition {
  persona: JourneyPersona;
  /** Canonical URL slug, e.g. "young-family". */
  slug: string;
  label: string;
  /** One-line value proposition shown on entry points and the journey header. */
  tagline: string;
  icon: string;
  /** Brand gradient pair used for entry cards (tailwind `from-X to-Y`). */
  gradient: string;
  /** Resource audiences this persona unions over. */
  audiences: ResourceAudience[];
  /** Community persona-segment tags this persona unions over. */
  personaSegments: string[];
}

/**
 * The persona registry. Order here is the display order on the journey hub.
 */
export const PERSONA_DEFINITIONS: readonly PersonaDefinition[] = [
  {
    persona: 'FAMILY',
    slug: 'young-family',
    label: 'Young Family',
    tagline: 'Schools, childcare, family visas and the people who get parenting here.',
    icon: '👨‍👩‍👧',
    gradient: 'from-orange-400 to-rose-500',
    audiences: ['NEWCOMER', 'FAMILY'],
    personaSegments: ['family'],
  },
  {
    persona: 'STUDENT',
    slug: 'student',
    label: 'Student',
    tagline: 'Visas, enrolment, part-time work and finding your circle.',
    icon: '🎓',
    gradient: 'from-indigo-500 to-blue-600',
    audiences: ['NEWCOMER', 'STUDENT', 'STUDENT_VISA'],
    personaSegments: ['student'],
  },
  {
    persona: 'PROFESSIONAL',
    slug: 'professional',
    label: 'Professional',
    tagline: 'Relocation, registration and a network in your field.',
    icon: '💼',
    gradient: 'from-teal-500 to-blue-600',
    audiences: ['NEWCOMER', 'EMPLOYEE'],
    personaSegments: ['professional'],
  },
  {
    persona: 'SKILLED_WORKER',
    slug: 'skilled-worker',
    label: 'Skilled Worker',
    tagline: 'Blue Card, recognition of qualifications and settling in.',
    icon: '🛠️',
    gradient: 'from-emerald-500 to-teal-600',
    audiences: ['NEWCOMER', 'EMPLOYEE'],
    personaSegments: ['newcomer', 'professional'],
  },
  {
    persona: 'FOUNDER',
    slug: 'founder',
    label: 'Founder',
    tagline: 'Company setup, visas for founders and the startup ecosystem.',
    icon: '🚀',
    gradient: 'from-rose-500 to-fuchsia-600',
    audiences: ['NEWCOMER', 'EMPLOYEE', 'FOUNDER'],
    personaSegments: ['professional'],
  },
  {
    persona: 'BUSINESS',
    slug: 'business',
    label: 'Business',
    tagline: 'Market entry, partners and operating across India and Germany.',
    icon: '🏢',
    gradient: 'from-indigo-500 to-fuchsia-600',
    audiences: ['NEWCOMER', 'EMPLOYEE', 'FOUNDER'],
    personaSegments: ['professional'],
  },
];

const BY_PERSONA = new Map<JourneyPersona, PersonaDefinition>(
  PERSONA_DEFINITIONS.map((d) => [d.persona, d]),
);
const BY_SLUG = new Map<string, PersonaDefinition>(PERSONA_DEFINITIONS.map((d) => [d.slug, d]));

/** Resolve a persona definition from its enum value. Total over JourneyPersona. */
export function getPersonaDefinition(persona: JourneyPersona): PersonaDefinition {
  const def = BY_PERSONA.get(persona);
  if (!def) {
    // Unreachable: the registry covers every JourneyPersona value.
    throw new Error(`No persona definition for "${persona}"`);
  }
  return def;
}

/** Resolve a persona definition from its URL slug, or null if unknown. */
export function getPersonaBySlug(slug: string): PersonaDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}
