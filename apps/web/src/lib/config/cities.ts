/** Launch city slugs that are currently active */
export const ACTIVE_CITIES = ['stuttgart', 'karlsruhe', 'mannheim', 'munich', 'frankfurt'] as const;

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
  munich: {
    satellites: [
      { slug: 'garching', name: 'Garching' },
      { slug: 'freising', name: 'Freising' },
      { slug: 'augsburg', name: 'Augsburg' },
      { slug: 'erding', name: 'Erding' },
    ],
  },
  frankfurt: {
    satellites: [
      { slug: 'offenbach', name: 'Offenbach' },
      { slug: 'darmstadt-sat', name: 'Darmstadt' },
      { slug: 'mainz', name: 'Mainz' },
      { slug: 'wiesbaden', name: 'Wiesbaden' },
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

/** Cities we're expanding to — shown as "Coming Soon" */
export const UPCOMING_CITIES = [
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
