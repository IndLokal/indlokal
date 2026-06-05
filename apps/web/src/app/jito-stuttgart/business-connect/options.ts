/**
 * Business Connect — shared option constants (taxonomy + status lifecycle).
 *
 * These are Business-Connect-scoped *shared defaults* reused across pilots; they
 * are intentionally NOT promoted to the platform-wide taxonomy in `@indlokal/shared`
 * (this is curated pilot territory, not a generic Business/Connect product). A
 * future pilot that needs different options can override per-pilot without touching
 * the engine. Per-pilot identity (slug, labels, consent version) lives in `./pilot`.
 */

import { ACTIVE_BUSINESS_CONNECT_PILOT, type BusinessConnectPilot } from './pilot';

export type { BusinessConnectPilot };
export {
  ACTIVE_BUSINESS_CONNECT_PILOT,
  BUSINESS_CONNECT_PILOTS,
  getBusinessConnectPilot,
  businessConnectPilotLabel,
} from './pilot';

/** Convenience re-exports bound to the currently active pilot (single source: `./pilot`). */
export const BUSINESS_CONNECT_PILOT_SLUG = ACTIVE_BUSINESS_CONNECT_PILOT.slug;
export const BUSINESS_CONNECT_EVENT_LABEL = ACTIVE_BUSINESS_CONNECT_PILOT.eventLabel;
export const BUSINESS_CONNECT_CONSENT_POLICY_VERSION =
  ACTIVE_BUSINESS_CONNECT_PILOT.consentPolicyVersion;

type Option = { value: string; label: string };

export const PARTICIPANT_TYPES: readonly Option[] = [
  { value: 'INDIAN_BUSINESS', label: 'Indian business' },
  { value: 'GERMAN_BUSINESS', label: 'German business' },
  { value: 'STARTUP_FOUNDER', label: 'Startup founder' },
  { value: 'INVESTOR_ADVISOR', label: 'Investor / advisor' },
  { value: 'SERVICE_PROVIDER', label: 'Service provider' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'COMMUNITY_ASSOCIATION', label: 'Community / business association' },
  { value: 'OTHER', label: 'Other' },
];

export const LOOKING_FOR_OPTIONS: readonly Option[] = [
  { value: 'GERMAN_BUYER', label: 'German buyer / customer' },
  { value: 'INDIAN_BUYER', label: 'Indian buyer / customer' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'LOCAL_PARTNER', label: 'Local partner' },
  { value: 'MARKET_ENTRY', label: 'Market-entry support' },
  { value: 'INVESTOR_ADVISOR', label: 'Investor / advisor' },
  { value: 'TECHNOLOGY_PARTNER', label: 'Technology partner' },
  { value: 'MANUFACTURING_PARTNER', label: 'Manufacturing partner' },
  { value: 'EVENT_SPONSOR', label: 'Event sponsor / collaboration' },
  { value: 'OTHER', label: 'Other' },
];

export const OFFERING_OPTIONS: readonly Option[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'DISTRIBUTION', label: 'Distribution' },
  { value: 'INVESTMENT_ADVISORY', label: 'Investment / advisory' },
  { value: 'TALENT_RECRUITMENT', label: 'Talent / recruitment' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'LOCAL_REPRESENTATION', label: 'Local representation' },
  { value: 'OTHER', label: 'Other' },
];

export const YES_NO_NOT_SURE: readonly Option[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'NOT_SURE', label: 'Not sure' },
];

export const PARTICIPANT_TYPE_VALUES = PARTICIPANT_TYPES.map((o) => o.value);
export const LOOKING_FOR_VALUES = LOOKING_FOR_OPTIONS.map((o) => o.value);
export const OFFERING_VALUES = OFFERING_OPTIONS.map((o) => o.value);
export const YES_NO_NOT_SURE_VALUES = YES_NO_NOT_SURE.map((o) => o.value);

const BUILD_LABEL_MAP = (options: readonly Option[]): Record<string, string> =>
  Object.fromEntries(options.map((o) => [o.value, o.label]));

export const PARTICIPANT_TYPE_LABELS = BUILD_LABEL_MAP(PARTICIPANT_TYPES);
export const LOOKING_FOR_LABELS = BUILD_LABEL_MAP(LOOKING_FOR_OPTIONS);
export const OFFERING_LABELS = BUILD_LABEL_MAP(OFFERING_OPTIONS);
export const YES_NO_NOT_SURE_LABELS = BUILD_LABEL_MAP(YES_NO_NOT_SURE);

export const BUSINESS_CONNECT_STATUSES = [
  'NEW',
  'REVIEWED',
  'SHORTLISTED',
  'MATCHED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type BusinessConnectStatusValue = (typeof BUSINESS_CONNECT_STATUSES)[number];
