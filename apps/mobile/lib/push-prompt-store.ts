import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mobileFlags } from './config/flags';
import { shouldShowPrePrompt, type PushPromptTrigger } from './push-preprompt-eligibility';

type PushPromptStore = {
  seenTriggers: PushPromptTrigger[];
  activeTrigger: PushPromptTrigger | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  openForTrigger: (trigger: PushPromptTrigger) => void;
  accept: () => void;
  decline: () => void;
  close: () => void;
  canShowForTrigger: (trigger: PushPromptTrigger) => boolean;
};

export const usePushPromptStore = create<PushPromptStore>()(
  persist(
    (set, get) => ({
      seenTriggers: [],
      activeTrigger: null,
      acceptedAt: null,
      declinedAt: null,

      canShowForTrigger: (trigger) =>
        shouldShowPrePrompt({
          enabled: mobileFlags.push.preprompt.enabled,
          enabledTriggers: mobileFlags.push.preprompt.triggers,
          seenTriggers: get().seenTriggers,
          trigger,
        }),

      openForTrigger: (trigger) => {
        if (!get().canShowForTrigger(trigger)) return;

        set((state) => ({
          activeTrigger: trigger,
          seenTriggers: state.seenTriggers.includes(trigger)
            ? state.seenTriggers
            : [...state.seenTriggers, trigger],
        }));
      },

      accept: () => {
        set({ activeTrigger: null, acceptedAt: new Date().toISOString() });
      },

      decline: () => {
        set({ activeTrigger: null, declinedAt: new Date().toISOString() });
      },

      close: () => {
        set({ activeTrigger: null });
      },
    }),
    {
      name: 'indlokal.push-prompt.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        seenTriggers: state.seenTriggers,
        acceptedAt: state.acceptedAt,
        declinedAt: state.declinedAt,
      }),
    },
  ),
);
