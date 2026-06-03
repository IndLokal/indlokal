import { describe, expect, it } from 'vitest';
import { recurrencePresetToRule, recurrenceRuleToPreset } from '@/lib/events/recurrence';

describe('recurrencePresetToRule', () => {
  it('maps weekly and monthly presets to RRULEs', () => {
    expect(recurrencePresetToRule('weekly')).toBe('FREQ=WEEKLY');
    expect(recurrencePresetToRule('monthly')).toBe('FREQ=MONTHLY');
  });

  it('maps none/custom to null', () => {
    expect(recurrencePresetToRule('none')).toBeNull();
    expect(recurrencePresetToRule('custom')).toBeNull();
  });
});

describe('recurrenceRuleToPreset', () => {
  it('maps known RRULEs to presets', () => {
    expect(recurrenceRuleToPreset('FREQ=WEEKLY;BYDAY=MO')).toBe('weekly');
    expect(recurrenceRuleToPreset('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('monthly');
  });

  it('maps unknown/non-empty rules to custom', () => {
    expect(recurrenceRuleToPreset('FREQ=DAILY')).toBe('custom');
  });

  it('maps empty/null rules to none', () => {
    expect(recurrenceRuleToPreset(null)).toBe('none');
    expect(recurrenceRuleToPreset('')).toBe('none');
  });
});
