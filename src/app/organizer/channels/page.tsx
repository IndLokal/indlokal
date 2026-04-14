import { requireSessionUser } from '@/lib/session';
import ChannelsForm from './ChannelsForm';

export const metadata = { title: 'Manage Channels — Organizer' };

export default async function ChannelsPage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-gray-500">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Manage Channels</h1>
      <p className="mt-1 text-sm text-gray-500">
        Control how people join and follow your community.
      </p>
      <ChannelsForm
        channels={community.accessChannels}
        citySlug={community.city.slug}
        communitySlug={community.slug}
      />
    </div>
  );
}
