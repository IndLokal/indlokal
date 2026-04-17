/**
 * Site-wide configuration constants.
 * Single source of truth for values referenced across modules.
 */

export const siteConfig = {
  name: 'LocalPulse',
  tagline: 'Your guide to Indian communities, events, and resources in Germany.',
  description:
    'Find Indian communities, events, festivals, and expat resources in your German city. See what is happening this week near you.',
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

/** Resource categories — hub & spoke structure for /[city]/resources/ */
export const RESOURCE_CATEGORIES = [
  {
    slug: 'city-registration',
    type: 'CITY_REGISTRATION' as const,
    title: 'City Registration & Visa',
    shortTitle: 'Registration & Visa',
    icon: '🏛️',
    description:
      'Anmeldung, residence permits, Blue Card, family reunion, and permanent residence.',
    color: 'from-blue-400 to-indigo-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-700',
    ringColor: 'ring-blue-200/60',
  },
  {
    slug: 'driving',
    type: 'DRIVING' as const,
    title: 'Driving in Germany',
    shortTitle: 'Driving',
    icon: '🚗',
    description: 'Licence conversion, Fahrschule, international permits, and traffic rules.',
    color: 'from-emerald-400 to-teal-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    ringColor: 'ring-emerald-200/60',
  },
  {
    slug: 'housing',
    type: 'HOUSING' as const,
    title: 'Housing & Accommodation',
    shortTitle: 'Housing',
    icon: '🏠',
    description: 'Apartment search, Schufa, GEZ, rental contracts, and deposits.',
    color: 'from-amber-400 to-orange-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    ringColor: 'ring-amber-200/60',
  },
  {
    slug: 'health-doctors',
    type: 'HEALTH_DOCTORS' as const,
    title: 'Health & Doctors',
    shortTitle: 'Health',
    icon: '🏥',
    description: 'Health insurance (GKV vs PKV), finding doctors, and emergency services.',
    color: 'from-rose-400 to-pink-500',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-700',
    ringColor: 'ring-rose-200/60',
  },
  {
    slug: 'jobs-careers',
    type: 'JOBS_CAREERS' as const,
    title: 'Jobs & Careers',
    shortTitle: 'Jobs',
    icon: '💼',
    description: 'Job portals, freelance visa, unemployment benefits, and networking.',
    color: 'from-violet-400 to-purple-500',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    ringColor: 'ring-violet-200/60',
  },
  {
    slug: 'tax-finance',
    type: 'TAX_FINANCE' as const,
    title: 'Tax & Finance',
    shortTitle: 'Tax & Finance',
    icon: '💰',
    description: 'Steuererklärung, DTAA, NRE/NRO accounts, ELSTER, and Steuerberater.',
    color: 'from-yellow-400 to-amber-500',
    bgLight: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    ringColor: 'ring-yellow-200/60',
  },
  {
    slug: 'business-setup',
    type: 'BUSINESS_SETUP' as const,
    title: 'Starting a Business',
    shortTitle: 'Business',
    icon: '🏢',
    description: 'Freiberufler vs Gewerbe, trade registration, and Finanzamt setup.',
    color: 'from-slate-400 to-gray-500',
    bgLight: 'bg-slate-50',
    textColor: 'text-slate-700',
    ringColor: 'ring-slate-200/60',
  },
  {
    slug: 'family-children',
    type: 'FAMILY_CHILDREN' as const,
    title: 'Family & Children',
    shortTitle: 'Family',
    icon: '👶',
    description: 'Kindergeld, Elterngeld, maternity leave, Kita search, and schools.',
    color: 'from-pink-400 to-rose-500',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-700',
    ringColor: 'ring-pink-200/60',
  },
  {
    slug: 'grocery-food',
    type: 'GROCERY_FOOD' as const,
    title: 'Indian Grocery & Food',
    shortTitle: 'Grocery & Food',
    icon: '🛒',
    description: 'Indian grocery stores, restaurants, online delivery, and cooking tips.',
    color: 'from-orange-400 to-red-500',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-700',
    ringColor: 'ring-orange-200/60',
  },
] as const;

/** Map ResourceType enum value → RESOURCE_CATEGORIES slug */
export const RESOURCE_TYPE_TO_SLUG: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.type, c.slug]),
);
export const RESOURCE_SLUG_TO_TYPE: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.slug, c.type]),
);

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
