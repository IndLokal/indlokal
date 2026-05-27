import { requireSessionUser } from '@/lib/session';
import EditProfileForm from './EditProfileForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const metadata = { title: 'Community Profile - Organizer' };

export default async function EditProfilePage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Community profile"
        description="Changes are reflected immediately on the public page."
      />
      <div className="mt-8">
        <EditProfileForm community={community} />
      </div>
    </div>
  );
}
