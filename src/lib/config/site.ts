export const siteConfig = {
  name: 'IndLokal',
  tagline: 'Your neighborhood, decoded.',
  description:
    'IndLokal means "My neighborhood". Discover Indian communities, events, and resources in your city with data-driven clarity.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://indlokal.de',
} as const;
