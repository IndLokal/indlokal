import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { getHostProfile, computeHostCompleteness } from '@/lib/organizer/host-workspace';
import { HostProfileForm } from './HostProfileForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Host Profile - Event Host' };

export default async function HostProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  const profile = getHostProfile(user);

  const [cities, eventCount] = await Promise.all([
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.event.count({ where: { createdByUserId: user.id } }),
  ]);

  const completeness = computeHostCompleteness(profile, eventCount > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OrganizerPageHeader
        title="Host Profile"
        description="How you appear publicly as the host on every event you post."
        backHref="/organizer/host"
      />

      <div className="card-base p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Profile completeness</h2>
          <span className="text-brand-600 text-sm font-medium">{completeness.pct}%</span>
        </div>
        <div className="bg-muted-bg mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-brand-500 h-full rounded-full transition-all"
            style={{ width: `${completeness.pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {completeness.items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.done ? 'text-success' : 'text-border'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card-base p-6">
        <HostProfileForm
          cities={cities}
          defaultDisplayName={profile.displayName ?? ''}
          defaultCityId={profile.cityId ?? ''}
          defaultLinks={profile.links}
        />
      </div>
    </div>
  );
}
