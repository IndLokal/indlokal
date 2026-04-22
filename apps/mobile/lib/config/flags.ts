import type { PushPromptTrigger } from '../push-preprompt-eligibility';

type AuthMethodFlag = {
  enabled: boolean;
};

const DEFAULT_PUSH_PREPROMPT_TRIGGERS: PushPromptTrigger[] = [
  'save_event',
  'follow_community',
  'rsvp',
];

function parsePushPromptTriggers(): PushPromptTrigger[] {
  const raw = process.env.EXPO_PUBLIC_PUSH_PREPROMPT_TRIGGERS;
  if (!raw) return DEFAULT_PUSH_PREPROMPT_TRIGGERS;

  const validTriggers = new Set<PushPromptTrigger>(DEFAULT_PUSH_PREPROMPT_TRIGGERS);
  const parsed = raw
    .split(',')
    .map((item: string) => item.trim())
    .filter((item: string): item is PushPromptTrigger =>
      validTriggers.has(item as PushPromptTrigger),
    );

  return parsed.length > 0 ? parsed : DEFAULT_PUSH_PREPROMPT_TRIGGERS;
}

export const authFlags: {
  apple: AuthMethodFlag;
  google: AuthMethodFlag;
  magic: AuthMethodFlag;
} = {
  apple: { enabled: process.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED !== 'false' },
  google: { enabled: process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED !== 'false' },
  magic: { enabled: process.env.EXPO_PUBLIC_AUTH_MAGIC_ENABLED !== 'false' },
};

export const mobileFlags = {
  auth: authFlags,
  push: {
    preprompt: {
      enabled: process.env.EXPO_PUBLIC_PUSH_PREPROMPT_ENABLED !== 'false',
      triggers: parsePushPromptTriggers(),
    },
  },
} as const;
