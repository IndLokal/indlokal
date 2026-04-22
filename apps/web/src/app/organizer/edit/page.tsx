import { requireSessionUser } from '@/lib/session';
import EditProfileForm from './EditProfileForm';

export const metadata = { title: 'Edit Profile — Organizer' };

export default async function EditProfilePage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-foreground text-2xl font-bold">Edit Profile</h1>
      <p className="text-muted mt-1 text-sm">
        Changes are reflected immediately on the public page.
      </p>
      <div className="mt-8">
        <EditProfileForm community={community} />
      </div>
    </div>
  );
}
