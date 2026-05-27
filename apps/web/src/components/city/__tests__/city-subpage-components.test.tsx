import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CitySubpageHeader } from '../CitySubpageHeader';
import { CitySubpageEmptyState } from '../CitySubpageEmptyState';

describe('CitySubpageHeader', () => {
  it('renders breadcrumb, title, and description', () => {
    render(
      <CitySubpageHeader
        city="stuttgart"
        cityName="Stuttgart"
        sectionLabel="Events"
        title="Indian Events in Stuttgart"
        description="12 upcoming events"
      />,
    );

    expect(screen.getByRole('link', { name: 'Stuttgart' })).toHaveAttribute('href', '/stuttgart');
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Indian Events in Stuttgart',
    );
    expect(screen.getByText('12 upcoming events')).toBeInTheDocument();
  });
});

describe('CitySubpageEmptyState', () => {
  it('renders title, description, and both action variants', () => {
    render(
      <CitySubpageEmptyState
        title="No business events yet"
        description="Try the full events feed or browse active communities for updates."
        actions={[
          { href: '/stuttgart/events', label: 'View all events', variant: 'primary' },
          { href: '/stuttgart/communities', label: 'Browse communities' },
        ]}
      />,
    );

    expect(screen.getByText('No business events yet')).toBeInTheDocument();
    expect(
      screen.getByText('Try the full events feed or browse active communities for updates.'),
    ).toBeInTheDocument();

    const primaryAction = screen.getByRole('link', { name: 'View all events' });
    const secondaryAction = screen.getByRole('link', { name: 'Browse communities' });

    expect(primaryAction).toHaveAttribute('href', '/stuttgart/events');
    expect(primaryAction.className).toContain('btn-primary');

    expect(secondaryAction).toHaveAttribute('href', '/stuttgart/communities');
    expect(secondaryAction.className).toContain('hover:underline');
  });

  it('renders no action links when actions are empty', () => {
    render(
      <CitySubpageEmptyState
        title="No communities yet"
        description="Check back soon."
        actions={[]}
      />,
    );

    expect(screen.getByText('No communities yet')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
