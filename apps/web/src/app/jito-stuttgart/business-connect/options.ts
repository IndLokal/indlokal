/**
 * Business Connect — shared option constants (taxonomy + status lifecycle).
 *
 * These are Business-Connect-scoped *shared defaults* reused across programs; they
 * are intentionally NOT promoted to the platform-wide taxonomy in `@indlokal/shared`
 * (this is curated program territory, not a generic Business/Connect product). A
 * program that needs different options can override them per-program in `./pilot`
 * (`participantTypes` / `lookingForOptions` / `offeringOptions`); the resolver
 * helpers below fall back to these defaults so the engine never forks. Per-program
 * identity (slug, labels, consent version) lives in `./pilot`.
 */

import {
  ACTIVE_BUSINESS_CONNECT_PROGRAM,
  type BusinessConnectOption,
  type BusinessConnectProgram,
} from './pilot';

export type { BusinessConnectProgram, BusinessConnectOption };
export {
  ACTIVE_BUSINESS_CONNECT_PROGRAM,
  BUSINESS_CONNECT_PROGRAMS,
  getBusinessConnectProgram,
  getBusinessConnectProgramByPartnerSlug,
  businessConnectProgramLabel,
} from './pilot';

/** Convenience re-exports bound to the currently active program (single source: `./pilot`). */
export const BUSINESS_CONNECT_PROGRAM_SLUG = ACTIVE_BUSINESS_CONNECT_PROGRAM.slug;
export const BUSINESS_CONNECT_EVENT_LABEL = ACTIVE_BUSINESS_CONNECT_PROGRAM.eventLabel;
export const BUSINESS_CONNECT_CONSENT_POLICY_VERSION =
  ACTIVE_BUSINESS_CONNECT_PROGRAM.consentPolicyVersion;

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
  { value: 'JOINT_VENTURE', label: 'Joint venture (JV) partner' },
  { value: 'MARKET_ENTRY', label: 'Market-entry support' },
  { value: 'CHANNEL_PARTNER', label: 'Channel / reseller partner' },
  { value: 'OEM_ODM_PARTNER', label: 'OEM / ODM partner' },
  { value: 'PROCUREMENT_PARTNER', label: 'Procurement / sourcing partner' },
  { value: 'COMPLIANCE_SUPPORT', label: 'Regulatory / compliance support' },
  { value: 'WAREHOUSING_LOGISTICS', label: 'Warehousing / logistics partner' },
  { value: 'INVESTOR_ADVISOR', label: 'Investor / advisor' },
  { value: 'COFOUNDER_LEADERSHIP', label: 'Co-founder / leadership hire' },
  { value: 'TALENT_HIRING', label: 'Talent hiring support' },
  { value: 'TECHNOLOGY_PARTNER', label: 'Technology partner' },
  { value: 'MANUFACTURING_PARTNER', label: 'Manufacturing partner' },
  { value: 'RND_COLLABORATION', label: 'R&D / university collaboration' },
  { value: 'EVENT_SPONSOR', label: 'Event sponsor / collaboration' },
  { value: 'OTHER', label: 'Other' },
];

export const OFFERING_OPTIONS: readonly Option[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'DISTRIBUTION', label: 'Distribution' },
  { value: 'CHANNEL_ACCESS', label: 'Channel / reseller access' },
  { value: 'OEM_ODM_CAPABILITY', label: 'OEM / ODM capability' },
  { value: 'SOURCING_PROCUREMENT', label: 'Sourcing / procurement' },
  { value: 'LOCAL_MARKET_ACCESS', label: 'Local market access' },
  { value: 'MARKET_ENTRY_SUPPORT', label: 'Market-entry support' },
  { value: 'REGULATORY_COMPLIANCE', label: 'Regulatory / compliance support' },
  { value: 'WAREHOUSING_FULFILLMENT', label: 'Warehousing / fulfillment' },
  { value: 'INVESTMENT_ADVISORY', label: 'Investment / advisory' },
  { value: 'TALENT_RECRUITMENT', label: 'Talent / recruitment' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'RND_CAPABILITY', label: 'R&D / prototyping capability' },
  { value: 'CERTIFICATION_TESTING', label: 'Certification / testing support' },
  { value: 'AFTER_SALES_SUPPORT', label: 'After-sales / service support' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Per-program taxonomy resolvers
//
// A program may override the three select taxonomies in its registry entry; when
// it doesn't, these return the shared defaults above. The form renders from these
// and the Zod schema derives its enums from the resolved values, so overrides stay
// in sync with validation automatically.
// ─────────────────────────────────────────────────────────────────────────────

export const programParticipantTypes = (program: BusinessConnectProgram): readonly Option[] =>
  program.participantTypes ?? PARTICIPANT_TYPES;

export const programLookingForOptions = (program: BusinessConnectProgram): readonly Option[] =>
  program.lookingForOptions ?? LOOKING_FOR_OPTIONS;

export const programOfferingOptions = (program: BusinessConnectProgram): readonly Option[] =>
  program.offeringOptions ?? OFFERING_OPTIONS;

export const BUSINESS_CONNECT_STATUSES = [
  'NEW',
  'REVIEWED',
  'SHORTLISTED',
  'MATCHED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type BusinessConnectStatusValue = (typeof BUSINESS_CONNECT_STATUSES)[number];
