import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildProfileUpdate, parseList, profileToFormValues } from './profile-form';

const base = {
  displayName: 'Asha',
  personaSegments: ['founder', 'newcomer'],
  preferredLanguages: ['en', 'hi'],
};

describe('profile/profile-form parseList', () => {
  it('splits on commas and newlines, trims, dedupes, drops empties', () => {
    assert.deepEqual(parseList('en, hi\nta ,, en'), ['en', 'hi', 'ta']);
    assert.deepEqual(parseList('   '), []);
    assert.deepEqual(parseList('Founder, founder'), ['Founder']);
  });
});

describe('profile/profile-form values', () => {
  it('seeds form values from a profile', () => {
    assert.deepEqual(profileToFormValues(base), {
      displayName: 'Asha',
      personaSegmentsText: 'founder, newcomer',
      preferredLanguagesText: 'en, hi',
    });
  });

  it('treats a null displayName as empty', () => {
    const v = profileToFormValues({ ...base, displayName: null });
    assert.equal(v.displayName, '');
  });
});

describe('profile/profile-form buildProfileUpdate', () => {
  it('returns unchanged when nothing differs', () => {
    const result = buildProfileUpdate(base, profileToFormValues(base));
    assert.equal(result.unchanged, true);
    assert.equal(result.update, undefined);
    assert.equal(result.errors.length, 0);
  });

  it('emits only changed fields', () => {
    const result = buildProfileUpdate(base, {
      displayName: 'Asha R',
      personaSegmentsText: 'founder, newcomer',
      preferredLanguagesText: 'en, hi',
    });
    assert.equal(result.unchanged, false);
    assert.deepEqual(result.update, { displayName: 'Asha R' });
  });

  it('emits changed lists', () => {
    const result = buildProfileUpdate(base, {
      displayName: 'Asha',
      personaSegmentsText: 'founder',
      preferredLanguagesText: 'en, hi, ta',
    });
    assert.deepEqual(result.update, {
      personaSegments: ['founder'],
      preferredLanguages: ['en', 'hi', 'ta'],
    });
  });

  it('rejects an empty display name', () => {
    const result = buildProfileUpdate(base, {
      displayName: '   ',
      personaSegmentsText: 'founder, newcomer',
      preferredLanguagesText: 'en, hi',
    });
    assert.equal(result.update, undefined);
    assert.ok(result.errors.some((e) => e.field === 'displayName'));
  });

  it('rejects too many interests', () => {
    const many = Array.from({ length: 11 }, (_, i) => `seg${i}`).join(', ');
    const result = buildProfileUpdate(base, {
      displayName: 'Asha',
      personaSegmentsText: many,
      preferredLanguagesText: 'en, hi',
    });
    assert.ok(result.errors.some((e) => e.field === 'personaSegmentsText'));
  });

  it('rejects an out-of-range language code', () => {
    const result = buildProfileUpdate(base, {
      displayName: 'Asha',
      personaSegmentsText: 'founder, newcomer',
      preferredLanguagesText: 'e',
    });
    assert.ok(result.errors.some((e) => e.field === 'preferredLanguagesText'));
  });
});
