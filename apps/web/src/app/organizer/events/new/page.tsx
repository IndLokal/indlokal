import { requireSessionUser } from '@/lib/session';
import AddEventForm from './AddEventForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const metadata = { title: 'Share Event - Organizer' };

export default async function AddEventPage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Share an event"
        description="Share your upcoming event with your community."
      />
      <div className="mt-8">
        <AddEventForm communityName={community.name} />
      </div>
    </div>
  );
}
