import { z } from 'zod';

export const RECURRENCE_PRESETS = ['none', 'weekly', 'monthly', 'custom'] as const;
export const RECURRENCE_PRESETS_CREATE = ['none', 'weekly', 'monthly'] as const;

export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];
export type CreateRecurrencePreset = (typeof RECURRENCE_PRESETS_CREATE)[number];

export const recurrencePresetSchema = z.enum(RECURRENCE_PRESETS);
export const createRecurrencePresetSchema = z.enum(RECURRENCE_PRESETS_CREATE);

export const DEFAULT_RECURRENCE_PRESET: CreateRecurrencePreset = 'none';

export const RECURRENCE_PRESET_LABELS: Record<RecurrencePreset, string> = {
  none: 'One-time event',
  weekly: 'Repeats weekly',
  monthly: 'Repeats monthly',
  custom: 'Custom recurrence (keep existing)',
};

const WEEKLY_RULE = 'FREQ=WEEKLY';
const MONTHLY_RULE = 'FREQ=MONTHLY';

export function recurrencePresetToRule(preset: RecurrencePreset): string | null {
  if (preset === 'weekly') return WEEKLY_RULE;
  if (preset === 'monthly') return MONTHLY_RULE;
  return null;
}

export function recurrenceRuleToPreset(rule: string | null | undefined): RecurrencePreset {
  if (!rule) return 'none';
  const upper = rule.toUpperCase();
  if (upper.includes(WEEKLY_RULE)) return 'weekly';
  if (upper.includes(MONTHLY_RULE)) return 'monthly';
  return 'custom';
}
