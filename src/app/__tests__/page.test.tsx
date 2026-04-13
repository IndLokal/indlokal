/**
 * Component tests — HomePage (landing page).
 *
 * Runs in jsdom environment.
 * next/link, next/navigation are mocked globally in src/test/setup.ts.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../page';

describe('HomePage', () => {
  it('renders the site name as the main heading', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('LocalPulse');
  });

  it('renders the tagline', async () => {
    render(await HomePage());
    expect(screen.getByText(/real-time guide/i)).toBeInTheDocument();
  });

  it('renders a link for every active city', async () => {
    render(await HomePage());
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Stuttgart as a city link pointing to /stuttgart', async () => {
    render(await HomePage());
    const stuttgartLink = screen.getByRole('link', { name: /stuttgart/i });
    expect(stuttgartLink).toHaveAttribute('href', '/stuttgart');
  });

  it('renders the "Choose your city" label', async () => {
    render(await HomePage());
    expect(screen.getByText(/choose your city/i)).toBeInTheDocument();
  });
});
