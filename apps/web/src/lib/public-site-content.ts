import type { CommunityActionCard } from '@/components/content/community-actions';

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

export const ABOUT_TOP_QUESTIONS_COPY = {
  title: 'What should I do next?',
  description:
    'Use this guide when you are not sure where to start. It covers the most common actions people take on IndLokal today.',
} as const;

export const ABOUT_TOP_QUESTION_CARDS: CommunityActionCard[] = [
  {
    id: 'find-events',
    audience: 'VISITORS',
    title: 'I want to find Indian events this week',
    body: 'Browse your city event feed to see upcoming events that are active now.',
    cta: 'Open city events',
    href: '/stuttgart/events',
  },
  {
    id: 'find-communities',
    audience: 'VISITORS',
    title: 'I want to find communities near me',
    body: 'Explore city community listings to discover cultural, language, and professional groups.',
    cta: 'Open city communities',
    href: '/stuttgart/communities',
  },
  {
    id: 'find-resources',
    audience: 'NEWCOMERS AND FAMILIES',
    title: 'I need practical city resources',
    body: 'Use local resource pages for consular and expat-life guidance relevant to your city.',
    cta: 'Open city resources',
    href: '/stuttgart/resources',
  },
  {
    id: 'suggest-missing',
    audience: 'COMMUNITY MEMBERS',
    title: 'Something is missing on IndLokal',
    body: 'Use contribute when a community, event, or resource should exist but is not listed yet.',
    cta: 'Contribute from city page',
    href: '/stuttgart/contribute',
  },
  {
    id: 'submit-new',
    audience: 'FOUNDERS AND MEMBERS',
    title: 'I am adding a new community',
    body: 'Submit a brand-new listing when the community is not yet on IndLokal.',
    cta: 'Submit a community',
    href: '/submit',
  },
  {
    id: 'organizer-access',
    audience: 'ORGANIZERS',
    title: 'I run a listed community',
    body: 'Open organizer access to claim or manage your listing, profile details, and events.',
    cta: 'Open organizer login',
    href: '/organizer/login',
  },
];

export function resolvePublicSiteUrl(siteUrl: string): string {
  return siteUrl.includes('localhost') ? 'https://indlokal.com' : siteUrl;
}
