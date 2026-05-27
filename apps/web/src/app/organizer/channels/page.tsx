import { requireSessionUser } from '@/lib/session';
import ChannelsForm from './ChannelsForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const metadata = { title: 'Community Links - Organizer' };

export default async function ChannelsPage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Community links"
        description="Choose how people can join and follow your community."
      />
      <ChannelsForm
        channels={community.accessChannels}
        citySlug={community.city.slug}
        communitySlug={community.slug}
      />
    </div>
  );
}
