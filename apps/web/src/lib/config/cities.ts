/**
 * Cities & taxonomy — single source of truth.
 *
 * Consumed by:
 *   - The Next.js app (route validation, navigation, copy)
 *   - prisma/bootstrap.ts (idempotent reference seed)
 *   - prisma/seed.ts (demo seed reuses bootstrap, then layers demo content)
 *
 * Adding a new active city = add an entry to ACTIVE_CITY_DATA. The bootstrap
 * (idempotent) creates or updates the row on next deploy. Nothing else.
 */

export type CitySeed = {
  name: string;
  slug: string;
  state: string;
  country?: string;
  latitude: number;
  longitude: number;
  population?: number;
  diasporaDensityEstimate?: number;
  isActive: boolean;
  isMetroPrimary: boolean;
  metroSlug?: string; // satellite -> primary metro slug
  timezone?: string;
  emoji?: string;
};

export type UpcomingCity = {
  slug: string;
  name: string;
  state: string;
  emoji?: string;
};

/* ─── Active metro cities (have public landing pages) ─────────────────── */

export const ACTIVE_CITY_DATA: CitySeed[] = [
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
  {
    name: 'Munich',
    slug: 'munich',
    state: 'Bavaria',
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
    state: 'Hesse',
    latitude: 50.1109,
    longitude: 8.6821,
    population: 773068,
    diasporaDensityEstimate: 14000,
    isActive: true,
    isMetroPrimary: true,
    emoji: '🏦',
  },
];

/* ─── Satellite cities (link to a metro, not publicly active) ─────────── */

export const SATELLITE_CITY_DATA: CitySeed[] = [
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
    name: 'Böblingen',
    slug: 'boeblingen',
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
  {
    name: 'Pforzheim',
    slug: 'pforzheim',
    state: 'Baden-Württemberg',
    latitude: 48.8922,
    longitude: 8.6946,
    population: 126016,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'karlsruhe',
  },
  // Mannheim metro
  {
    name: 'Heidelberg',
    slug: 'heidelberg-sat',
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
  // Munich metro
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
  // Frankfurt metro
  {
    name: 'Offenbach',
    slug: 'offenbach',
    state: 'Hesse',
    latitude: 50.0956,
    longitude: 8.7761,
    population: 130280,
    isActive: false,
    isMetroPrimary: false,
    metroSlug: 'frankfurt',
  },
  {
    name: 'Darmstadt',
    slug: 'darmstadt-sat',
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
];

/* ─── Derived constants used by the app ──────────────────────────────── */

/** Active metro slugs — used for routing and validation. */
export const ACTIVE_CITIES = ACTIVE_CITY_DATA.map((c) => c.slug) as readonly string[];

/** Metro region map: metro slug → its satellite town list. Derived. */
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

/** Reverse map: satellite slug → metro slug. Derived. */
export const SATELLITE_TO_METRO: Record<string, string> = Object.fromEntries(
  SATELLITE_CITY_DATA.filter((s) => s.metroSlug).map((s) => [s.slug, s.metroSlug as string]),
);

/** Cities we plan to launch — shown as "Coming Soon" cards. Not seeded. */
export const UPCOMING_CITIES: readonly UpcomingCity[] = [
  { slug: 'berlin', name: 'Berlin', state: 'Berlin', emoji: '🐻' },
  { slug: 'hamburg', name: 'Hamburg', state: 'Hamburg', emoji: '⚓' },
  { slug: 'dusseldorf', name: 'Düsseldorf', state: 'NRW', emoji: '🗼' },
  { slug: 'cologne', name: 'Cologne', state: 'NRW', emoji: '⛪' },
  { slug: 'heidelberg', name: 'Heidelberg', state: 'Baden-Württemberg', emoji: '🏰' },
  { slug: 'darmstadt', name: 'Darmstadt', state: 'Hesse', emoji: '🔬' },
  { slug: 'nuremberg', name: 'Nuremberg', state: 'Bavaria', emoji: '🏯' },
  { slug: 'aachen', name: 'Aachen', state: 'NRW', emoji: '♨️' },
] as const;

/** All known city slugs (active + upcoming) — used for sitemap/validation. */
export const ALL_CITY_SLUGS = [
  ...ACTIVE_CITIES,
  ...UPCOMING_CITIES.map((c) => c.slug),
] as readonly string[];

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
