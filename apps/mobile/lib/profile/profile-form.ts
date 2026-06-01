/**
 * Editable profile form logic - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports), unit-testable in Node. Builds and validates
 * the partial OnboardingUpdate payload for PATCH /api/v1/me/onboarding from the
 * current profile + the user's edited form values, sending only changed fields.
 */

import { auth } from '@indlokal/shared';

export interface ProfileFormValues {
  displayName: string;
  /** Comma- or newline-separated persona segments, free text. */
  personaSegmentsText: string;
  /** Comma- or newline-separated language codes/labels, free text. */
  preferredLanguagesText: string;
}

export interface ProfileFormError {
  field: keyof ProfileFormValues;
  message: string;
}

/** Seed editable form values from the signed-in user's current profile. */
export function profileToFormValues(
  profile: Pick<auth.MeProfile, 'displayName' | 'personaSegments' | 'preferredLanguages'>,
): ProfileFormValues {
  return {
    displayName: profile.displayName ?? '',
    personaSegmentsText: profile.personaSegments.join(', '),
    preferredLanguagesText: profile.preferredLanguages.join(', '),
  };
}

/** Split a free-text list (commas or newlines) into trimmed, de-duped, non-empty tokens. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const token = raw.trim();
    if (token.length === 0) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

export interface BuildProfileUpdateResult {
  /** Validation errors; when non-empty, `update` is undefined. */
  errors: ProfileFormError[];
  /** The diffed, validated patch - undefined when invalid. */
  update?: auth.OnboardingUpdate;
  /** True when the form matches the current profile (nothing to save). */
  unchanged: boolean;
}

/**
 * Diff edited form values against the current profile and produce a validated
 * partial OnboardingUpdate containing only the fields that changed.
 */
export function buildProfileUpdate(
  current: Pick<auth.MeProfile, 'displayName' | 'personaSegments' | 'preferredLanguages'>,
  values: ProfileFormValues,
): BuildProfileUpdateResult {
  const errors: ProfileFormError[] = [];

  const displayName = values.displayName.trim();
  if (displayName.length === 0) {
    errors.push({ field: 'displayName', message: 'Display name is required.' });
  } else if (displayName.length > 80) {
    errors.push({ field: 'displayName', message: 'Display name must be 80 characters or fewer.' });
  }

  const personaSegments = parseList(values.personaSegmentsText);
  if (personaSegments.length > 10) {
    errors.push({ field: 'personaSegmentsText', message: 'Choose at most 10 interests.' });
  }
  if (personaSegments.some((segment) => segment.length > 40)) {
    errors.push({
      field: 'personaSegmentsText',
      message: 'Each interest must be 40 characters or fewer.',
    });
  }

  const preferredLanguages = parseList(values.preferredLanguagesText);
  if (preferredLanguages.length > 10) {
    errors.push({ field: 'preferredLanguagesText', message: 'Choose at most 10 languages.' });
  }
  if (preferredLanguages.some((lang) => lang.length < 2 || lang.length > 10)) {
    errors.push({
      field: 'preferredLanguagesText',
      message: 'Each language must be 2-10 characters.',
    });
  }

  if (errors.length > 0) {
    return { errors, unchanged: false };
  }

  const patch: auth.OnboardingUpdate = {};
  if (displayName !== (current.displayName ?? '')) patch.displayName = displayName;
  if (!sameList(personaSegments, current.personaSegments)) patch.personaSegments = personaSegments;
  if (!sameList(preferredLanguages, current.preferredLanguages)) {
    patch.preferredLanguages = preferredLanguages;
  }

  const unchanged = Object.keys(patch).length === 0;
  if (unchanged) {
    return { errors: [], unchanged: true };
  }

  // Final contract check - guards against drift between this logic and the schema.
  const parsed = auth.OnboardingUpdate.safeParse(patch);
  if (!parsed.success) {
    return {
      errors: [{ field: 'displayName', message: 'Please review your entries and try again.' }],
      unchanged: false,
    };
  }

  return { errors: [], update: parsed.data, unchanged: false };
}
