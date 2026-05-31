import AddEventForm from './AddEventForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';

export const metadata = { title: 'Share Event - Organizer' };

export default async function AddEventPage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Share an event"
        description="Share your upcoming event with your active community workspace."
        backHref="/organizer/events"
        backLabel="Back to events"
      />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />
      <div className="mt-8">
        <AddEventForm communityName={community.name} />
      </div>
    </div>
  );
}
