import ChannelsForm from '../channels/ChannelsForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';

export const metadata = { title: 'Community Links - Organizer' };

export default async function OrganizerLinksPage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <OrganizerPageHeader
        title="Community links"
        description="Choose how people can join and follow your community."
      />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />
      <ChannelsForm
        channels={community.accessChannels}
        citySlug={community.city.slug}
        communitySlug={community.slug}
      />
    </div>
  );
}
