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

describe('HomePage', () => {
  it('renders the main heading', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /discover what.*happening/i,
    );
  });

  it('renders the value proposition tagline', async () => {
    render(await HomePage());
    expect(screen.getByText(/for the indian community in germany/i)).toBeInTheDocument();
  });

  it('renders a link for every active city', async () => {
    render(await HomePage());
    const stuttgartLink = screen.getByRole('link', { name: /stuttgart/i });
    expect(stuttgartLink).toBeInTheDocument();
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
