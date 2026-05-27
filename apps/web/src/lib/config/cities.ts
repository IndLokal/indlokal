import { normalizeCityLookupKey } from '@/lib/city-resolution';

/**
 * Cities & taxonomy - single source of truth.
 *
 * Design principles:
 * - Active metros represent currently prioritized markets for product and ops.
 * - Satellites attach to a metro to widen discovery and capture nearby demand.
 * - Upcoming metros represent the expansion pipeline and can be promoted over time.
 *
 * This model is intentionally iterative: adjust coverage by moving cities between
 * ACTIVE_CITY_DATA, SATELLITE_CITY_DATA, and UPCOMING_CITIES as GTM evolves.
 */

export type CitySeed = {
  name: string;
  slug: string;
  state: string;
  country?: string;
  aliases?: string[];
  latitude: number;
  longitude: number;
  population?: number;
  diasporaDensityEstimate?: number;
  isActive: boolean;
  isMetroPrimary: boolean;
  metroSlug?: string;
  timezone?: string;
  emoji?: string;
};

export type UpcomingCity = {
  slug: string;
  name: string;
  state: string;
  emoji?: string;
  notes?: string;
};

export type CityCommunityProfile = {
  emoji: string;
  notes: string;
};

export const CITY_COMMUNITY_PROFILES: Record<string, CityCommunityProfile> = {
  berlin: {
    emoji: '🏛️',
    notes: 'Student, startup, and tech hub.',
  },
  munich: {
    emoji: '⚙️',
    notes: 'Automotive, semiconductors, and engineering base.',
  },
  frankfurt: {
    emoji: '🏦',
    notes: 'Finance, consulting, aviation, and IT.',
  },
  hamburg: {
    emoji: '⚓',
    notes: 'Shipping, logistics, and global trade.',
  },
  dusseldorf: {
    emoji: '🗼',
    notes: 'NRW business and expat corridor.',
  },
  stuttgart: {
    emoji: '🚗',
    notes: 'Automotive and embedded engineering city.',
  },
  erlangen: {
    emoji: '🏥',
    notes: 'Siemens, FAU, and health-tech talent.',
  },
  cologne: {
    emoji: '⛪',
    notes: 'Media, services, and student ecosystem.',
  },
  aachen: {
    emoji: '🎓',
    notes: 'RWTH-led engineering student ecosystem.',
  },
  mannheim: {
    emoji: '🏭',
    notes: 'Industry, pharma, and Rhein-Neckar access.',
  },
  braunschweig: {
    emoji: '✈️',
    notes: 'Automotive R&D and aerospace cluster.',
  },
  essen: {
    emoji: '🏗️',
    notes: 'Core city in NRW industrial belt.',
  },
  bonn: {
    emoji: '🌐',
    notes: 'UN institutions, telecom, and academia.',
  },
  dresden: {
    emoji: '💾',
    notes: 'Semiconductor growth and deep-tech hiring.',
  },
  karlsruhe: {
    emoji: '⚡',
    notes: 'KIT, software, and research ecosystem.',
  },
  nuremberg: {
    emoji: '🏯',
    notes: 'Manufacturing and logistics powerhouse.',
  },
};

/* ─── Active metro cities (currently prioritized markets) ────────────── */

export const ACTIVE_CITY_DATA: CitySeed[] = [
  {
    name: 'Berlin',
    slug: 'berlin',
    state: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    population: 3780000,
    diasporaDensityEstimate: 22000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🐻',
  },
  {
    name: 'Munich',
    slug: 'munich',
    state: 'Bavaria',
    aliases: ['München', 'Munchen'],
    latitude: 48.1351,
    longitude: 11.582,
    population: 1488202,
    diasporaDensityEstimate: 18000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🥨',
  },
  {
    name: 'Frankfurt',
    slug: 'frankfurt',
    aliases: ['Frankfurt am Main', 'Frankfurt a. M.'],
    state: 'Hesse',
    latitude: 50.1109,
    longitude: 8.6821,
    population: 773068,
    diasporaDensityEstimate: 14000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🏦',
  },
  {
    name: 'Stuttgart',
    slug: 'stuttgart',
    state: 'Baden-Württemberg',
    latitude: 48.7758,
    longitude: 9.1829,
    population: 634830,
    diasporaDensityEstimate: 12000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🚗',
  },
  {
    name: 'Karlsruhe',
    slug: 'karlsruhe',
    state: 'Baden-Württemberg',
    latitude: 49.0069,
    longitude: 8.4037,
    population: 313092,
    diasporaDensityEstimate: 6000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '⚖️',
  },
  {
    name: 'Mannheim',
    slug: 'mannheim',
    state: 'Baden-Württemberg',
    latitude: 49.4875,
    longitude: 8.466,
    population: 310658,
    diasporaDensityEstimate: 5500,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🏭',
  },
];

/* ─── Satellite cities (nearby expansion around each active metro) ───── */

export const SATELLITE_CITY_DATA: CitySeed[] = [
  // Berlin metro
  {
    name: 'Potsdam',
    slug: 'potsdam',
    state: 'Brandenburg',
    latitude: 52.39,
    longitude: 13.0645,
    population: 187441,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Falkensee',
    slug: 'falkensee',
    state: 'Brandenburg',
    latitude: 52.5601,
    longitude: 13.0927,
    population: 45839,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Oranienburg',
    slug: 'oranienburg',
    state: 'Brandenburg',
    latitude: 52.7537,
    longitude: 13.2369,
    population: 47495,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Bernau bei Berlin',
    slug: 'bernau-bei-berlin',
    state: 'Brandenburg',
    latitude: 52.679,
    longitude: 13.5871,
    population: 43236,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Koenigs Wusterhausen',
    slug: 'koenigs-wusterhausen',
    aliases: ['Königs Wusterhausen'],
    state: 'Brandenburg',
    latitude: 52.2964,
    longitude: 13.625,
    population: 39417,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Teltow',
    slug: 'teltow',
    state: 'Brandenburg',
    latitude: 52.3958,
    longitude: 13.2561,
    population: 28523,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Hennigsdorf',
    slug: 'hennigsdorf',
    state: 'Brandenburg',
    latitude: 52.6376,
    longitude: 13.204,
    population: 27357,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Kleinmachnow',
    slug: 'kleinmachnow',
    state: 'Brandenburg',
    latitude: 52.407,
    longitude: 13.2255,
    population: 20838,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Schoenefeld',
    slug: 'schoenefeld',
    aliases: ['Schönefeld'],
    state: 'Brandenburg',
    latitude: 52.3887,
    longitude: 13.5183,
    population: 20657,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  {
    name: 'Erkner',
    slug: 'erkner',
    state: 'Brandenburg',
    latitude: 52.4245,
    longitude: 13.7568,
    population: 12176,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'berlin',
  },
  // Stuttgart metro
  {
    name: 'Sindelfingen',
    slug: 'sindelfingen',
    state: 'Baden-Württemberg',
    latitude: 48.7133,
    longitude: 9.0028,
    population: 64858,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Boeblingen',
    slug: 'boeblingen',
    aliases: ['Böblingen'],
    state: 'Baden-Württemberg',
    latitude: 48.6833,
    longitude: 9.0167,
    population: 49312,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Ludwigsburg',
    slug: 'ludwigsburg',
    state: 'Baden-Württemberg',
    latitude: 48.8975,
    longitude: 9.1922,
    population: 93593,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Esslingen',
    slug: 'esslingen',
    aliases: ['Esslingen am Neckar'],
    state: 'Baden-Württemberg',
    latitude: 48.7397,
    longitude: 9.3108,
    population: 94046,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Leonberg',
    slug: 'leonberg',
    state: 'Baden-Württemberg',
    latitude: 48.8,
    longitude: 9.0167,
    population: 48670,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Renningen',
    slug: 'renningen',
    state: 'Baden-Württemberg',
    latitude: 48.7697,
    longitude: 8.935,
    population: 18652,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Göppingen',
    slug: 'goeppingen',
    state: 'Baden-Württemberg',
    latitude: 48.7033,
    longitude: 9.6519,
    population: 57868,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Waiblingen',
    slug: 'waiblingen',
    state: 'Baden-Württemberg',
    latitude: 48.831,
    longitude: 9.318,
    population: 55663,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Fellbach',
    slug: 'fellbach',
    state: 'Baden-Württemberg',
    latitude: 48.8094,
    longitude: 9.2761,
    population: 46214,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Leinfelden-Echterdingen',
    slug: 'leinfelden-echterdingen',
    state: 'Baden-Württemberg',
    latitude: 48.6928,
    longitude: 9.1428,
    population: 41185,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Filderstadt',
    slug: 'filderstadt',
    state: 'Baden-Württemberg',
    latitude: 48.6803,
    longitude: 9.2183,
    population: 46243,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  {
    name: 'Ostfildern',
    slug: 'ostfildern',
    state: 'Baden-Württemberg',
    latitude: 48.7333,
    longitude: 9.25,
    population: 39778,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'stuttgart',
  },
  // Karlsruhe metro
  {
    name: 'Ettlingen',
    slug: 'ettlingen',
    state: 'Baden-Württemberg',
    latitude: 48.9419,
    longitude: 8.4078,
    population: 39960,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'karlsruhe',
  },
  {
    name: 'Bruchsal',
    slug: 'bruchsal',
    state: 'Baden-Württemberg',
    latitude: 49.1244,
    longitude: 8.5981,
    population: 45323,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'karlsruhe',
  },
  {
    name: 'Pforzheim',
    slug: 'pforzheim',
    aliases: ['Pforzheim (Enz)'],
    state: 'Baden-Württemberg',
    latitude: 48.8922,
    longitude: 8.6946,
    population: 126016,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'karlsruhe',
  },
  {
    name: 'Rastatt',
    slug: 'rastatt',
    state: 'Baden-Württemberg',
    latitude: 48.8589,
    longitude: 8.2061,
    population: 49805,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'karlsruhe',
  },

  // Mannheim metro
  {
    name: 'Heidelberg',
    slug: 'heidelberg',
    state: 'Baden-Württemberg',
    latitude: 49.3988,
    longitude: 8.6724,
    population: 159914,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Ludwigshafen',
    slug: 'ludwigshafen',
    state: 'Rhineland-Palatinate',
    latitude: 49.4774,
    longitude: 8.4452,
    population: 172145,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Worms',
    slug: 'worms',
    state: 'Rhineland-Palatinate',
    latitude: 49.6341,
    longitude: 8.3592,
    population: 84646,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Weinheim',
    slug: 'weinheim',
    state: 'Baden-Württemberg',
    latitude: 49.5494,
    longitude: 8.6675,
    population: 45634,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Schwetzingen',
    slug: 'schwetzingen',
    state: 'Baden-Württemberg',
    latitude: 49.3825,
    longitude: 8.5775,
    population: 22159,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Frankenthal',
    slug: 'frankenthal',
    state: 'Rhineland-Palatinate',
    latitude: 49.5372,
    longitude: 8.356,
    population: 50003,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },
  {
    name: 'Hockenheim',
    slug: 'hockenheim',
    state: 'Baden-Württemberg',
    latitude: 49.3245,
    longitude: 8.545,
    population: 21791,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'mannheim',
  },

  // Munich metro
  {
    name: 'Augsburg',
    slug: 'augsburg',
    state: 'Bavaria',
    latitude: 48.3705,
    longitude: 10.8978,
    population: 296478,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Freising',
    slug: 'freising',
    state: 'Bavaria',
    latitude: 48.4028,
    longitude: 11.7489,
    population: 49234,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Garching',
    slug: 'garching',
    state: 'Bavaria',
    latitude: 48.2487,
    longitude: 11.6511,
    population: 18247,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Erding',
    slug: 'erding',
    state: 'Bavaria',
    latitude: 48.3064,
    longitude: 11.9069,
    population: 36469,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Dachau',
    slug: 'dachau',
    state: 'Bavaria',
    latitude: 48.2626,
    longitude: 11.4335,
    population: 48456,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Fuerstenfeldbruck',
    slug: 'fuerstenfeldbruck',
    state: 'Bavaria',
    latitude: 48.1796,
    longitude: 11.255,
    population: 39171,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Unterschleissheim',
    slug: 'unterschleissheim',
    state: 'Bavaria',
    latitude: 48.2804,
    longitude: 11.5766,
    population: 30124,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },
  {
    name: 'Starnberg',
    slug: 'starnberg',
    state: 'Bavaria',
    latitude: 47.998,
    longitude: 11.3449,
    population: 23716,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'munich',
  },

  // Frankfurt metro
  {
    name: 'Offenbach',
    slug: 'offenbach',
    aliases: ['Offenbach am Main'],
    state: 'Hesse',
    latitude: 50.0956,
    longitude: 8.7761,
    population: 130280,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Wiesbaden',
    slug: 'wiesbaden',
    state: 'Hesse',
    latitude: 50.0826,
    longitude: 8.24,
    population: 278342,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Darmstadt',
    slug: 'darmstadt',
    state: 'Hesse',
    latitude: 49.8728,
    longitude: 8.6512,
    population: 159207,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Mainz',
    slug: 'mainz',
    state: 'Rhineland-Palatinate',
    latitude: 49.9929,
    longitude: 8.2473,
    population: 218578,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Hanau',
    slug: 'hanau',
    state: 'Hesse',
    latitude: 50.1264,
    longitude: 8.9283,
    population: 101364,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Bad Homburg vor der Hoehe',
    slug: 'bad-homburg',
    aliases: ['Bad Homburg vor der Höhe'],
    state: 'Hesse',
    latitude: 50.2268,
    longitude: 8.6182,
    population: 54892,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Neu-Isenburg',
    slug: 'neu-isenburg',
    state: 'Hesse',
    latitude: 50.0483,
    longitude: 8.6944,
    population: 39218,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Giessen',
    slug: 'giessen',
    aliases: ['Gießen'],
    state: 'Hesse',
    latitude: 50.5841,
    longitude: 8.6784,
    population: 91604,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Marburg',
    slug: 'marburg',
    state: 'Hesse',
    latitude: 50.8075,
    longitude: 8.7708,
    population: 76731,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Fulda',
    slug: 'fulda',
    state: 'Hesse',
    latitude: 50.5558,
    longitude: 9.6808,
    population: 68635,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
];

/* ─── Derived constants used by app and pipeline ─────────────────────── */

export const ACTIVE_CITIES = ACTIVE_CITY_DATA.map((c) => c.slug) as readonly string[];

export const METRO_REGIONS: Record<string, { satellites: { slug: string; name: string }[] }> =
  Object.fromEntries(
    ACTIVE_CITY_DATA.map((m) => [
      m.slug,
      {
        satellites: SATELLITE_CITY_DATA.filter((s) => s.metroSlug === m.slug).map((s) => ({
          slug: s.slug,
          name: s.name,
        })),
      },
    ]),
  );

export const SATELLITE_TO_METRO: Record<string, string> = Object.fromEntries(
  SATELLITE_CITY_DATA.filter((s) => s.metroSlug).map((s) => [s.slug, s.metroSlug as string]),
);

export const CITY_NAME_ALIASES: Record<string, string> = Object.fromEntries(
  [...ACTIVE_CITY_DATA, ...SATELLITE_CITY_DATA].flatMap((city) =>
    (city.aliases ?? []).map((alias) => [normalizeCityLookupKey(alias), city.slug] as const),
  ),
);

/**
 * Upcoming metros are intentionally pre-modeled so GTM can stage expansion.
 * These should stay focused on larger expansion metros, not secondary cities.
 */
export const UPCOMING_CITIES: readonly UpcomingCity[] = [
  {
    slug: 'hamburg',
    name: 'Hamburg',
    state: 'Hamburg',
    emoji: '⚓',
    notes: CITY_COMMUNITY_PROFILES.hamburg.notes,
  },
  {
    slug: 'dusseldorf',
    name: 'Düsseldorf',
    state: 'NRW',
    emoji: '🗼',
    notes: CITY_COMMUNITY_PROFILES.dusseldorf.notes,
  },
  {
    slug: 'erlangen',
    name: 'Erlangen',
    state: 'Bavaria',
    emoji: '🏥',
    notes: CITY_COMMUNITY_PROFILES.erlangen.notes,
  },
  {
    slug: 'cologne',
    name: 'Cologne',
    state: 'NRW',
    emoji: '⛪',
    notes: CITY_COMMUNITY_PROFILES.cologne.notes,
  },
  {
    slug: 'aachen',
    name: 'Aachen',
    state: 'NRW',
    emoji: '🎓',
    notes: CITY_COMMUNITY_PROFILES.aachen.notes,
  },
  {
    slug: 'braunschweig',
    name: 'Braunschweig',
    state: 'Lower Saxony',
    emoji: '✈️',
    notes: CITY_COMMUNITY_PROFILES.braunschweig.notes,
  },
  {
    slug: 'essen',
    name: 'Essen',
    state: 'NRW',
    emoji: '🏗️',
    notes: CITY_COMMUNITY_PROFILES.essen.notes,
  },
  {
    slug: 'bonn',
    name: 'Bonn',
    state: 'NRW',
    emoji: '🌐',
    notes: CITY_COMMUNITY_PROFILES.bonn.notes,
  },
  {
    slug: 'dresden',
    name: 'Dresden',
    state: 'Saxony',
    emoji: '💾',
    notes: CITY_COMMUNITY_PROFILES.dresden.notes,
  },
  {
    slug: 'nuremberg',
    name: 'Nuremberg',
    state: 'Bavaria',
    emoji: '🏯',
    notes: CITY_COMMUNITY_PROFILES.nuremberg.notes,
  },
  { slug: 'wiesbaden', name: 'Wiesbaden', state: 'Hesse', emoji: '💧' },
  { slug: 'kassel', name: 'Kassel', state: 'Hesse', emoji: '🌳' },
] as const;

export const ALL_CITY_SLUGS = [
  ...ACTIVE_CITIES,
  ...UPCOMING_CITIES.map((c) => c.slug),
] as readonly string[];

export const CITY_DISPLAY_NAME_BY_SLUG: Record<string, string> = Object.fromEntries([
  ...ACTIVE_CITY_DATA.map((city) => [city.slug, city.name] as const),
  ...SATELLITE_CITY_DATA.map((city) => [city.slug, city.name] as const),
  ...UPCOMING_CITIES.map((city) => [city.slug, city.name] as const),
]);

/** Resolve a human-friendly configured city name for a slug, when known. */
export function getConfiguredCityName(slug: string): string | undefined {
  return CITY_DISPLAY_NAME_BY_SLUG[slug];
}

/* ─── Taxonomy: Categories & Personas ────────────────────────────────── */

export type TaxonomySeed = {
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
};

export const CATEGORY_TAXONOMY: TaxonomySeed[] = [
  { name: 'Cultural', slug: 'cultural', icon: '🎭', sortOrder: 1 },
  { name: 'Student', slug: 'student', icon: '🎓', sortOrder: 2 },
  { name: 'Professional', slug: 'professional', icon: '💼', sortOrder: 3 },
  { name: 'Religious', slug: 'religious', icon: '🙏', sortOrder: 4 },
  { name: 'Language & Regional', slug: 'language-regional', icon: '🗣️', sortOrder: 5 },
  { name: 'Sports & Fitness', slug: 'sports-fitness', icon: '⚽', sortOrder: 6 },
  { name: 'Family & Kids', slug: 'family-kids', icon: '👨‍👩‍👧', sortOrder: 7 },
  { name: 'Networking & Social', slug: 'networking-social', icon: '🤝', sortOrder: 8 },
  { name: 'Food & Cooking', slug: 'food-cooking', icon: '🍛', sortOrder: 9 },
  { name: 'Arts & Entertainment', slug: 'arts-entertainment', icon: '🎵', sortOrder: 10 },
  { name: 'Consular & Official', slug: 'consular-official', icon: '🏛️', sortOrder: 11 },
];

export const PERSONA_TAXONOMY: TaxonomySeed[] = [
  { name: 'Newcomer', slug: 'newcomer', icon: '🆕', sortOrder: 1 },
  { name: 'Student', slug: 'persona-student', icon: '📚', sortOrder: 2 },
  { name: 'Working Professional', slug: 'working-professional', icon: '💻', sortOrder: 3 },
  { name: 'Family', slug: 'family', icon: '👨‍👩‍👧‍👦', sortOrder: 4 },
  { name: 'Single', slug: 'single', icon: '🙋', sortOrder: 5 },
];
