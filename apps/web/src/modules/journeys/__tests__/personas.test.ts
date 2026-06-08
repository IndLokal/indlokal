/**
 * Persona registry unit tests — PRD/TDD-0052 §4.
 *
 * The persona mapping must be TOTAL over JourneyPersona (composeJourney calls
 * getPersonaDefinition for any persona) and slugs must be unique + stable.
 */
import { describe, expect, it } from 'vitest';
import { journeys as j } from '@indlokal/shared';
import { PERSONA_DEFINITIONS, getPersonaDefinition, getPersonaBySlug } from '../personas';

describe('persona registry', () => {
  it('defines exactly one entry per JourneyPersona enum value', () => {
    const enumValues = j.JourneyPersona.options;
    const registryPersonas = PERSONA_DEFINITIONS.map((d) => d.persona).sort();
    expect(registryPersonas).toEqual([...enumValues].sort());
  });

  it('resolves a definition for every persona (totality)', () => {
    for (const persona of j.JourneyPersona.options) {
      const def = getPersonaDefinition(persona);
      expect(def.persona).toBe(persona);
      expect(def.audiences.length).toBeGreaterThan(0);
    }
  });

  it('has unique, non-empty slugs', () => {
    const slugs = PERSONA_DEFINITIONS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s.length).toBeGreaterThan(0);
  });

  it('maps the young-family slug to FAMILY → audience FAMILY, segment family', () => {
    const def = getPersonaBySlug('young-family');
    expect(def?.persona).toBe('FAMILY');
    expect(def?.audiences).toContain('FAMILY');
    expect(def?.personaSegments).toContain('family');
  });

  it('returns null for an unknown slug', () => {
    expect(getPersonaBySlug('nope')).toBeNull();
  });
});
