import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinueJourneyChip } from '../ContinueJourneyChip';

describe('ContinueJourneyChip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a continue link when last journey matches the city and option list', () => {
    localStorage.setItem(
      'journey:last',
      JSON.stringify({ citySlug: 'stuttgart', personaSlug: 'founder', ts: Date.now() }),
    );

    render(
      <ContinueJourneyChip
        citySlug="stuttgart"
        options={[{ slug: 'founder', label: 'Founder', icon: '🚀' }]}
      />,
    );

    expect(screen.getByRole('link', { name: /continue your founder guide/i })).toHaveAttribute(
      'href',
      '/stuttgart/journeys/founder',
    );
  });

  it('does not emit a cached-snapshot warning when store event fires without storage changes', () => {
    localStorage.setItem(
      'journey:last',
      JSON.stringify({ citySlug: 'stuttgart', personaSlug: 'founder', ts: Date.now() }),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ContinueJourneyChip
        citySlug="stuttgart"
        options={[{ slug: 'founder', label: 'Founder', icon: '🚀' }]}
      />,
    );

    act(() => {
      window.dispatchEvent(new Event('journey:last-changed'));
      window.dispatchEvent(new Event('journey:last-changed'));
    });

    const allMessages = errorSpy.mock.calls
      .map((call) => call.map((arg) => String(arg)).join(' '))
      .join('\n');

    expect(allMessages).not.toContain('The result of getSnapshot should be cached');
    expect(allMessages).not.toContain('Maximum update depth exceeded');
  });
});
