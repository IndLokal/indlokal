/**
 * Shared resource category config - hub & spoke structure for
 * /[city]/resources/ on web and Resources tab on mobile.
 *
 * Web pulls Tailwind classes from `color/bgLight/textColor/ringColor`.
 * Mobile uses only `slug/type/title/shortTitle/icon/description`.
 */

import type { ResourceType } from '../contracts/resources';

export interface ResourceCategory {
  slug: string;
  type: ResourceType;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
  /** Tailwind gradient (web only). */
  color: string;
  /** Tailwind background (web only). */
  bgLight: string;
  /** Tailwind text colour (web only). */
  textColor: string;
  /** Tailwind ring (web only). */
  ringColor: string;
}

export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  {
    slug: 'city-registration',
    type: 'CITY_REGISTRATION',
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
    type: 'DRIVING',
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
    type: 'HOUSING',
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
    type: 'HEALTH_DOCTORS',
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
    type: 'JOBS_CAREERS',
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
    type: 'TAX_FINANCE',
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
    type: 'BUSINESS_SETUP',
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
    type: 'FAMILY_CHILDREN',
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
    type: 'GROCERY_FOOD',
    title: 'Indian Grocery & Food',
    shortTitle: 'Grocery & Food',
    icon: '🛒',
    description: 'Indian grocery stores, restaurants, online delivery, and cooking tips.',
    color: 'from-orange-400 to-red-500',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-700',
    ringColor: 'ring-orange-200/60',
  },
  {
    slug: 'consular-services',
    type: 'CONSULAR_SERVICE',
    title: 'Consular Services',
    shortTitle: 'Consular Services',
    icon: '🇮🇳',
    description: 'Indian consulate services, official events, government info, and visa updates.',
    color: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-700',
    ringColor: 'ring-orange-200/60',
  },
  {
    slug: 'community-resource',
    type: 'COMMUNITY_RESOURCE',
    title: 'Community Resources',
    shortTitle: 'Community',
    icon: '🤝',
    description: 'Community platforms, networks, local initiatives, and cultural groups.',
    color: 'from-cyan-400 to-blue-500',
    bgLight: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    ringColor: 'ring-cyan-200/60',
  },
] as const;

export const RESOURCE_TYPE_TO_SLUG: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.type, c.slug]),
);
export const RESOURCE_SLUG_TO_TYPE: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.slug, c.type]),
);
