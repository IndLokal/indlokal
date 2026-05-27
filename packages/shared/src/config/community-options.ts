export const CHANNEL_TYPE_VALUES = [
  'WHATSAPP',
  'TELEGRAM',
  'WEBSITE',
  'FACEBOOK',
  'INSTAGRAM',
  'EMAIL',
  'MEETUP',
  'YOUTUBE',
  'LINKEDIN',
  'OTHER',
] as const;

export type CommunityChannelType = (typeof CHANNEL_TYPE_VALUES)[number];

export const CHANNEL_TYPE_LABELS: Record<CommunityChannelType, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  EMAIL: 'Email',
  MEETUP: 'Meetup',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  OTHER: 'Other',
};

export const CHANNEL_TYPE_ICONS: Record<CommunityChannelType, string> = {
  WHATSAPP: '💬',
  TELEGRAM: '✈️',
  WEBSITE: '🌐',
  FACEBOOK: '📘',
  INSTAGRAM: '📸',
  EMAIL: '✉️',
  MEETUP: '🤝',
  YOUTUBE: '▶️',
  LINKEDIN: '💼',
  OTHER: '🔗',
};

export const COMMUNITY_LANGUAGE_VALUES = [
  'Hindi',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Urdu',
  'English',
  'German',
] as const;

export type CommunityLanguage = (typeof COMMUNITY_LANGUAGE_VALUES)[number];

export const PERSONA_SEGMENT_VALUES = [
  'student',
  'family',
  'professional',
  'newcomer',
  'cultural',
  'religious',
  'sports',
  'food',
] as const;

export type PersonaSegment = (typeof PERSONA_SEGMENT_VALUES)[number];

export const PERSONA_SEGMENT_LABELS: Record<PersonaSegment, string> = {
  student: 'Student',
  family: 'Family / Parents',
  professional: 'Professional',
  newcomer: 'Newcomer (< 2 years in Germany)',
  cultural: 'Cultural enthusiast',
  religious: 'Religious / Spiritual',
  sports: 'Sports & Fitness',
  food: 'Food & Cooking',
};
