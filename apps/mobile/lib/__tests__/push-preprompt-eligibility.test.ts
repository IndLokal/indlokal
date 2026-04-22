import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowPrePrompt } from '../push-preprompt-eligibility';

test('shows preprompt when feature is enabled and trigger not seen', () => {
  const result = shouldShowPrePrompt({
    enabled: true,
    enabledTriggers: ['save_event', 'follow_community', 'rsvp'],
    seenTriggers: [],
    trigger: 'save_event',
  });

  assert.equal(result, true);
});

test('does not show preprompt when trigger was already shown', () => {
  const result = shouldShowPrePrompt({
    enabled: true,
    enabledTriggers: ['save_event', 'follow_community', 'rsvp'],
    seenTriggers: ['save_event'],
    trigger: 'save_event',
  });

  assert.equal(result, false);
});

test('does not show preprompt when feature is disabled', () => {
  const result = shouldShowPrePrompt({
    enabled: false,
    enabledTriggers: ['save_event', 'follow_community', 'rsvp'],
    seenTriggers: [],
    trigger: 'rsvp',
  });

  assert.equal(result, false);
});
