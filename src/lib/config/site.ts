export const siteConfig = {
  name: 'LocalPulse',
  tagline: 'Your guide to Indian communities, events, and resources in Germany.',
  description:
    'Find Indian communities, events, festivals, and expat resources in your German city. See what is happening this week near you.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://localpulse.de',
} as const;
