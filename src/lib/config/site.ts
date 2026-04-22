export const siteConfig = {
  name: 'IndLokal',
  tagline: 'Your Indian community, locally.',
  description:
    'IndLokal is the city-first discovery platform for the Indian diaspora in Germany — the active communities, the events worth knowing about this week, and the practical resources Indians actually need.',
  shortDescription:
    'Indian communities, events & expat-life resources, active near you in Germany.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://indlokal.de',
  twitter: '@indlokal',
} as const;
