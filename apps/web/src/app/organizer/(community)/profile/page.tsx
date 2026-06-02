import EditProfileForm from '../edit/EditProfileForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { OrganizerWorkspaceBanner } from '@/components/organizer/workspace-banner';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { db } from '@/lib/db';
import CityChangeRequestForm from './CityChangeRequestForm';

export const metadata = { title: 'Community Profile - Organizer' };

export default async function OrganizerProfilePage() {
  const { user, community, role, isMultiCommunity } = await requireOrganizerWorkspace();

  if (!community) {
    return <p className="text-muted">No community found.</p>;
  }

  const cityOptions = await db.city.findMany({
    where: { OR: [{ isActive: true }, { metroRegionId: { not: null } }] },
    select: { id: true, name: true, slug: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const metadata =
    community.metadata && typeof community.metadata === 'object'
      ? (community.metadata as Record<string, unknown>)
      : {};
  const existingRequest =
    metadata.cityChangeRequest && typeof metadata.cityChangeRequest === 'object'
      ? (metadata.cityChangeRequest as {
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          toCityId?: string;
          toCitySlug?: string;
          reason?: string;
          requestedAt?: string;
          reviewNote?: string;
        })
      : null;
  const canRequestCityChange =
    user.role === 'PLATFORM_ADMIN' || community.claimedByUserId === user.id;

  return (
    <div className="max-w-2xl">
      <OrganizerPageHeader
        title="Community Profile"
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
      {canRequestCityChange && (
        <CityChangeRequestForm
          currentCityName={community.city.name}
          currentCityId={community.city.id}
          cityOptions={cityOptions}
          existingRequest={existingRequest}
        />
      )}
    </div>
  );
}
