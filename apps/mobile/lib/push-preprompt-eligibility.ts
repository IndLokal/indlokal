export type PushPromptTrigger = 'save_event' | 'follow_community' | 'rsvp';

type ShouldShowPrePromptInput = {
  enabled: boolean;
  enabledTriggers: PushPromptTrigger[];
  seenTriggers: PushPromptTrigger[];
  trigger: PushPromptTrigger;
};

export function shouldShowPrePrompt(input: ShouldShowPrePromptInput): boolean {
  if (!input.enabled) return false;
  if (!input.enabledTriggers.includes(input.trigger)) return false;
  if (input.seenTriggers.includes(input.trigger)) return false;
  return true;
}
