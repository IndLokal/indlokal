import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrganizerWorkspaceBanner } from '../workspace-banner';

describe('OrganizerWorkspaceBanner', () => {
  it('shows the active community context and owner role', () => {
    const { container } = render(
      <OrganizerWorkspaceBanner communityName="IndLokal" cityName="Stuttgart" role="OWNER" />,
    );
    const banner = within(container);

    expect(banner.getByText('Active workspace')).toBeInTheDocument();
    expect(banner.getByText('IndLokal')).toBeInTheDocument();
    expect(banner.getByText(/Stuttgart/)).toBeInTheDocument();
    expect(banner.getByText('Owner')).toBeInTheDocument();
  });

  it('links to community switching when multiple workspaces are available', () => {
    render(
      <OrganizerWorkspaceBanner
        communityName="IndLokal"
        cityName="Stuttgart"
        role="COLLABORATOR"
        showSwitchLink
      />,
    );

    const switchLink = screen.getByRole('link', { name: /switch community/i });
    expect(screen.getByText('Collaborator')).toBeInTheDocument();
    expect(switchLink).toHaveAttribute('href', '/organizer/communities');
  });
});
