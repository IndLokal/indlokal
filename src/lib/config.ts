/**
 * Site-wide configuration constants.
 * Single source of truth for values referenced across modules.
 */

export const siteConfig = {
  name: 'LocalPulse',
  tagline: 'The real-time guide to Indian communities and events near you.',
  description:
    'Discover Indian communities, events, and cultural activities in your German city. Find what is happening this week for the Indian diaspora.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://localpulse.de',
} as const;

/** Launch city slugs that are currently active */
export const ACTIVE_CITIES = ['stuttgart', 'karlsruhe', 'mannheim'] as const;

/**
 * Metro regions — maps satellite town slugs to their metro primary city.
 * Used for routing (redirect satellite → metro) and for display on city cards.
 */
export const METRO_REGIONS: Record<string, { satellites: { slug: string; name: string }[] }> = {
  stuttgart: {
    satellites: [
      { slug: 'sindelfingen', name: 'Sindelfingen' },
      { slug: 'boeblingen', name: 'Böblingen' },
      { slug: 'ludwigsburg', name: 'Ludwigsburg' },
      { slug: 'esslingen', name: 'Esslingen' },
      { slug: 'leonberg', name: 'Leonberg' },
      { slug: 'goeppingen', name: 'Göppingen' },
      { slug: 'waiblingen', name: 'Waiblingen' },
      { slug: 'fellbach', name: 'Fellbach' },
    ],
  },
  karlsruhe: {
    satellites: [
      { slug: 'ettlingen', name: 'Ettlingen' },
      { slug: 'bruchsal', name: 'Bruchsal' },
      { slug: 'rastatt', name: 'Rastatt' },
      { slug: 'pforzheim', name: 'Pforzheim' },
    ],
  },
  mannheim: {
    satellites: [
      { slug: 'heidelberg-sat', name: 'Heidelberg' },
      { slug: 'ludwigshafen', name: 'Ludwigshafen' },
      { slug: 'weinheim', name: 'Weinheim' },
      { slug: 'schwetzingen', name: 'Schwetzingen' },
    ],
  },
};

/** Reverse map: satellite slug → metro city slug */
export const SATELLITE_TO_METRO: Record<string, string> = {};
for (const [metro, region] of Object.entries(METRO_REGIONS)) {
  for (const sat of region.satellites) {
    SATELLITE_TO_METRO[sat.slug] = metro;
  }
}

/** All searchable town names with their target city slug */
export const SEARCHABLE_TOWNS: { name: string; slug: string; metro: string }[] = [
  // Active cities themselves
  ...ACTIVE_CITIES.map((c) => ({
    name: c.charAt(0).toUpperCase() + c.slice(1),
    slug: c,
    metro: c,
  })),
  // All satellites
  ...Object.entries(METRO_REGIONS).flatMap(([metro, region]) =>
    region.satellites.map((s) => ({ name: s.name, slug: s.slug, metro })),
  ),
];

/** Cities we're expanding to — shown as "Coming Soon" */
export const UPCOMING_CITIES = [
  { slug: 'munich', name: 'Munich', state: 'Bavaria', emoji: '🏔️' },
  { slug: 'frankfurt', name: 'Frankfurt', state: 'Hesse', emoji: '🏦' },
  { slug: 'berlin', name: 'Berlin', state: 'Berlin', emoji: '🐻' },
  { slug: 'hamburg', name: 'Hamburg', state: 'Hamburg', emoji: '⚓' },
  { slug: 'dusseldorf', name: 'Düsseldorf', state: 'NRW', emoji: '🗼' },
  { slug: 'cologne', name: 'Cologne', state: 'NRW', emoji: '⛪' },
  { slug: 'heidelberg', name: 'Heidelberg', state: 'Baden-Württemberg', emoji: '🏰' },
  { slug: 'darmstadt', name: 'Darmstadt', state: 'Hesse', emoji: '🔬' },
  { slug: 'nuremberg', name: 'Nuremberg', state: 'Bavaria', emoji: '🏯' },
  { slug: 'aachen', name: 'Aachen', state: 'NRW', emoji: '♨️' },
] as const;

/** All known city slugs (active + upcoming) */
export const ALL_CITY_SLUGS = [...ACTIVE_CITIES, ...UPCOMING_CITIES.map((c) => c.slug)] as const;

/** Scoring thresholds */
export const SCORING = {
  /** Days with no activity before a community is considered stale */
  STALE_THRESHOLD_DAYS: 90,
  /** Minimum items in "this week" before auto-expanding to "this month" */
  SPARSE_CONTENT_THRESHOLD: 3,
} as const;

/** All 11 MVP categories (slugs) */
export const CATEGORIES = [
  'cultural',
  'student',
  'professional',
  'religious',
  'language-regional',
  'sports-fitness',
  'family-kids',
  'networking-social',
  'food-cooking',
  'arts-entertainment',
  'consular-official',
] as const;
