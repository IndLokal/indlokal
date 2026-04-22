/**
 * Component tests — HomePage (landing page).
 *
 * Runs in jsdom environment.
 * next/link, next/navigation are mocked globally in src/test/setup.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../page';

// Mock components that depend on server-side context
vi.mock('@/components/NavAuthWidget', () => ({
  NavAuthWidget: () => null,
}));

vi.mock('@/components/layout', () => ({
  Footer: () => null,
}));

// CitySearch is a client component that calls useState; the page-test runs the
// server HomePage in jsdom which doesn't dispatch React's client renderer for
// nested client boundaries — mock it out.
vi.mock('../CitySearch', () => ({
  CitySearch: () => null,
}));

describe('HomePage', () => {
  it('renders the main heading', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/your indian community/i);
  });

  it('renders the value proposition tagline', async () => {
    render(await HomePage());
    expect(screen.getByText(/for the indian diaspora in germany/i)).toBeInTheDocument();
  });

  it('renders a link for every active city', async () => {
    render(await HomePage());
    const stuttgartLinks = screen.getAllByRole('link', { name: /stuttgart/i });
    expect(stuttgartLinks.length).toBeGreaterThan(0);
  });

  it('renders Stuttgart as a city link pointing to /stuttgart', async () => {
    render(await HomePage());
    const stuttgartLinks = screen.getAllByRole('link', { name: /stuttgart/i });
    expect(stuttgartLinks.some((l) => l.getAttribute('href') === '/stuttgart')).toBe(true);
  });

  it('renders the "Expanding across Germany" section', async () => {
    render(await HomePage());
    expect(screen.getByText(/expanding across germany/i)).toBeInTheDocument();
  });
});
