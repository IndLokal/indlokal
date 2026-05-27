export const siteConfig = {
  name: 'IndLokal',
  tagline: 'Your Indian community, locally.',
  description:
    'IndLokal helps Indians in Germany discover active local communities, upcoming events, and essential expat-life resources in one city-first platform.',
  shortDescription:
    'Indian communities, events & expat-life resources, active near you in Germany.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://indlokal.com',
  twitter: '@indlokal',
} as const;
