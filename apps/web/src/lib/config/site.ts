export const siteConfig = {
  name: 'IndLokal',
  tagline: 'Your Indian community, locally.',
  description:
    'IndLokal helps Indians in Germany navigate life in their new city — the active local communities, the events worth knowing about this week, and the practical expat-life resources you actually need, all in one place.',
  shortDescription:
    'Navigate Indian life in Germany — active communities, events & practical resources, near you.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://indlokal.com',
  twitter: '@indlokal',
} as const;
