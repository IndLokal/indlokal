import { describe, expect, it } from 'vitest';
import { CITY_NAME_ALIASES } from '@/lib/config/cities';
import { normalizeCityLookupKey, resolveCityMatch } from '../city-resolution';

describe('normalizeCityLookupKey', () => {
  it('normalizes accents, punctuation, and spacing consistently', () => {
    expect(normalizeCityLookupKey('Leinfelden Echterdingen')).toBe('leinfelden-echterdingen');
    expect(normalizeCityLookupKey('Frankfurt a. M.')).toBe('frankfurt-a-m');
    expect(normalizeCityLookupKey('München')).toBe('munchen');
  });
});

describe('resolveCityMatch', () => {
  const cities = [
    { id: '1', slug: 'munich', name: 'Munich' },
    { id: '2', slug: 'leinfelden-echterdingen', name: 'Leinfelden-Echterdingen' },
    { id: '3', slug: 'frankfurt', name: 'Frankfurt' },
    { id: '4', slug: 'esslingen', name: 'Esslingen' },
  ];

  it('matches localized aliases from the city source of truth', () => {
    const match = resolveCityMatch('München', cities, CITY_NAME_ALIASES);
    expect(match?.id).toBe('1');
  });

  it('matches shared source-of-truth aliases for satellite cities', () => {
    const match = resolveCityMatch('Esslingen am Neckar', cities, CITY_NAME_ALIASES);
    expect(match?.id).toBe('4');
  });

  it('matches normalized hyphenated city names via slug lookup', () => {
    const match = resolveCityMatch('Leinfelden Echterdingen', cities, CITY_NAME_ALIASES);
    expect(match?.id).toBe('2');
  });

  it('matches normalized aliases with punctuation differences', () => {
    const match = resolveCityMatch('Frankfurt a M', cities, CITY_NAME_ALIASES);
    expect(match?.id).toBe('3');
  });

  it('matches exact city names directly', () => {
    const match = resolveCityMatch('Frankfurt', cities, CITY_NAME_ALIASES);
    expect(match?.id).toBe('3');
  });
});
