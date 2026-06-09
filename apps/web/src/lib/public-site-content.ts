export const PUBLIC_SITE_LAST_REVIEWED = '27 May 2026';

export const PUBLIC_SITE_EMAILS = {
  contact: 'contact@indlokal.com',
  privacy: 'privacy@indlokal.com',
  legal: 'legal@indlokal.com',
  support: 'support@indlokal.com',
} as const;

export const PUBLIC_SITE_SOCIALS = {
  instagram: 'https://instagram.com/indlokal',
  linkedin: 'https://linkedin.com/company/indlokal',
} as const;

export const DISCOVERY_FOUNDATION_CARDS = [
  {
    icon: '🪷',
    title: 'Communities',
    desc: 'A curated, activity-ranked map of the Indian cultural associations, language groups, religious organisations, student bodies and professional networks alive in your city.',
  },
  {
    icon: '📅',
    title: 'Events',
    desc: "What's happening for Indians this week - from Diwali and garba to cricket leagues and consular camps. Surfaced by freshness, not by who posted last.",
  },
  {
    icon: '🧭',
    title: 'Resources',
    desc: 'Plain-English guides to Anmeldung, Kindergeld, EU Blue Card, GKV vs PKV, Steuererklärung - plus Indian grocers, English-friendly doctors and CGI consular dates.',
  },
] as const;

export const JOURNEYS_PUBLIC_COPY = {
  title: 'Journeys for moving to Germany',
  description:
    'Step-by-step journeys for Indians moving to Germany — the resources, communities and events that matter for your situation, in the order you need them.',
  intro:
    'A journey is a guided path — the official steps, trusted communities and upcoming events that matter for your situation, in the order you need them.',
  cityIntro:
    'A journey is a guided path — the resources, communities and events that matter for your situation, in the order you need them.',
} as const;

export function resolvePublicSiteUrl(siteUrl: string): string {
  return siteUrl.includes('localhost') ? 'https://indlokal.com' : siteUrl;
}
