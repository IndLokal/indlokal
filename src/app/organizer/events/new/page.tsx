import { requireSessionUser } from '@/lib/session';
import AddEventForm from './AddEventForm';

export const metadata = { title: 'Add Event — Organizer' };

export default async function AddEventPage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-gray-500">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Add Event</h1>
      <p className="mt-1 text-sm text-gray-500">
        Events appear on your community page and the city events feed.
      </p>
      <div className="mt-8">
        <AddEventForm communityName={community.name} />
      </div>
    </div>
  );
}
