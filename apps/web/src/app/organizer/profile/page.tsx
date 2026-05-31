import EditProfileForm from '../edit/EditProfileForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';

export const metadata = { title: 'Community Profile - Organizer' };

export default async function OrganizerProfilePage() {
  const { community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Community page"
        description="Edit the public community listing visitors see on IndLokal."
      />
      <OrganizerWorkspaceBanner
        communityName={community.name}
        cityName={community.city.name}
        role={role}
        showSwitchLink={isMultiCommunity}
      />
      <div className="mt-8">
        <EditProfileForm community={community} />
      </div>
    </div>
  );
}
