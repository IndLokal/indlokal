import AddEventForm from './AddEventForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { db } from '@/lib/db';

export const metadata = { title: 'Share Event - Organizer' };

export default async function AddEventPage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();
  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { slug: true, name: true, icon: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
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
      <div>
        <AddEventForm communityName={community.name} categories={categories} />
      </div>
    </div>
  );
}
