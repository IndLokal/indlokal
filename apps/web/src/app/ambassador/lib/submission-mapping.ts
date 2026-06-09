import { communityOptions } from '@indlokal/shared';
import type { ExtractedCommunity, ExtractedEvent } from '@/modules/pipeline';

const AMBASSADOR_CONFIDENCE = 0.75;

const EVENT_FIELD_KEYS: Array<keyof ExtractedEvent> = [
  'title',
  'description',
  'date',
  'time',
  'endDate',
  'endTime',
  'venueName',
  'venueAddress',
  'cityName',
  'isOnline',
  'isFree',
  'cost',
  'registrationUrl',
  'imageUrl',
  'hostCommunity',
  'categories',
  'languages',
];

const COMMUNITY_FIELD_KEYS: Array<keyof ExtractedCommunity> = [
  'name',
  'description',
  'cityName',
  'categories',
  'languages',
  'websiteUrl',
  'facebookUrl',
  'instagramUrl',
  'whatsappUrl',
  'telegramUrl',
  'contactEmail',
];

type CommunityChannelType = (typeof communityOptions.CHANNEL_TYPE_VALUES)[number];

type CommunityChannelMapping = Pick<
  ExtractedCommunity,
  'websiteUrl' | 'facebookUrl' | 'instagramUrl' | 'whatsappUrl' | 'telegramUrl' | 'contactEmail'
> & {
  supplementalChannels: Array<{ type: CommunityChannelType; value: string }>;
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toOptional(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = toOptional(value);
  return normalized?.replace(/^mailto:/i, '') ?? null;
}

function buildFieldConfidence<T extends Record<string, unknown>>(data: T, keys: Array<keyof T>) {
  return Object.fromEntries(
    keys.map((key) => {
      const value = data[key];
      const hasValue = Array.isArray(value)
        ? value.length > 0
        : typeof value === 'boolean'
          ? true
          : value !== null && value !== undefined && value !== '';
      return [key, hasValue ? 0.9 : 0.45];
    }),
  );
}

function getCommunityChannelMapping(
  channelType: CommunityChannelType,
  channelValue: string | null | undefined,
  contactEmail: string | null | undefined,
): CommunityChannelMapping {
  const value = toOptional(channelValue);
  const email = normalizeEmail(contactEmail);

  const mapping: CommunityChannelMapping = {
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    telegramUrl: null,
    contactEmail: email,
    supplementalChannels: [],
  };

  if (!value) {
    return mapping;
  }

  switch (channelType) {
    case 'WEBSITE':
      mapping.websiteUrl = value;
      break;
    case 'FACEBOOK':
      mapping.facebookUrl = value;
      break;
    case 'INSTAGRAM':
      mapping.instagramUrl = value;
      break;
    case 'WHATSAPP':
      mapping.whatsappUrl = value;
      break;
    case 'TELEGRAM':
      mapping.telegramUrl = value;
      break;
    case 'EMAIL':
      mapping.contactEmail = normalizeEmail(value) ?? email;
      break;
    default:
      mapping.supplementalChannels.push({ type: channelType, value });
      break;
  }

  return mapping;
}

export function sanitizeLanguages(values: string[]) {
  const validLanguages = new Set(communityOptions.COMMUNITY_LANGUAGE_VALUES);
  return unique(values).filter(
    (value): value is (typeof communityOptions.COMMUNITY_LANGUAGE_VALUES)[number] =>
      validLanguages.has(value as (typeof communityOptions.COMMUNITY_LANGUAGE_VALUES)[number]),
  );
}

export function normalizeCommunityChannelType(
  value: string | null | undefined,
): CommunityChannelType {
  return communityOptions.CHANNEL_TYPE_VALUES.includes(value as CommunityChannelType)
    ? (value as CommunityChannelType)
    : 'WHATSAPP';
}

export function buildAmbassadorEventExtractedData({
  title,
  description,
  date,
  time,
  endDate,
  endTime,
  venueName,
  venueAddress,
  cityName,
  isOnline,
  isFree,
  cost,
  registrationUrl,
  hostCommunity,
  categories,
  languages,
}: {
  title: string;
  description?: string | null;
  date?: string | null;
  time?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  cityName?: string | null;
  isOnline: boolean;
  isFree: boolean | null;
  cost?: string | null;
  registrationUrl?: string | null;
  hostCommunity?: string | null;
  categories: string[];
  languages: string[];
}): ExtractedEvent {
  const extracted: ExtractedEvent = {
    type: 'EVENT',
    title,
    description: toOptional(description),
    date: toOptional(date),
    time: toOptional(time),
    endDate: toOptional(endDate),
    endTime: toOptional(endTime),
    venueName: toOptional(venueName),
    venueAddress: toOptional(venueAddress),
    cityName: toOptional(cityName),
    isOnline,
    isFree,
    cost: isFree === false ? toOptional(cost) : null,
    registrationUrl: toOptional(registrationUrl),
    imageUrl: null,
    hostCommunity: toOptional(hostCommunity),
    categories: unique(categories),
    languages: sanitizeLanguages(languages),
    confidence: AMBASSADOR_CONFIDENCE,
    fieldConfidence: {} as ExtractedEvent['fieldConfidence'],
  };

  extracted.fieldConfidence = buildFieldConfidence(extracted, EVENT_FIELD_KEYS);
  return extracted;
}

export function buildAmbassadorCommunityExtractedData({
  name,
  description,
  cityName,
  categories,
  languages,
  channelType,
  channelValue,
  contactEmail,
}: {
  name: string;
  description?: string | null;
  cityName?: string | null;
  categories: string[];
  languages: string[];
  channelType: CommunityChannelType;
  channelValue?: string | null;
  contactEmail?: string | null;
}) {
  const channelMapping = getCommunityChannelMapping(channelType, channelValue, contactEmail);

  const extracted: ExtractedCommunity = {
    type: 'COMMUNITY',
    name,
    description: toOptional(description),
    cityName: toOptional(cityName),
    categories: unique(categories),
    languages: sanitizeLanguages(languages),
    websiteUrl: channelMapping.websiteUrl,
    facebookUrl: channelMapping.facebookUrl,
    instagramUrl: channelMapping.instagramUrl,
    whatsappUrl: channelMapping.whatsappUrl,
    telegramUrl: channelMapping.telegramUrl,
    contactEmail: channelMapping.contactEmail,
    confidence: AMBASSADOR_CONFIDENCE,
    fieldConfidence: {} as ExtractedCommunity['fieldConfidence'],
  };

  extracted.fieldConfidence = buildFieldConfidence(extracted, COMMUNITY_FIELD_KEYS);

  return {
    extracted,
    supplementalChannels: channelMapping.supplementalChannels,
  };
}
