import Link from 'next/link';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { redirect } from 'next/navigation';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const metadata = { title: 'My Communities - Organizer Portal' };
export const dynamic = 'force-dynamic';

export default async function OrganizerCommunitiesPage() {
  const { user, community: activeCommunity } = await requireOrganizerWorkspace();

  if (user.claimedCommunities.length === 0) {
    redirect('/organizer');
  }

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="My Communities"
        description={`${user.claimedCommunities.length} community profile${user.claimedCommunities.length !== 1 ? 's' : ''}`}
        backHref="/organizer"
        backLabel="Back to organizer home"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {user.claimedCommunities.map(
          (c: {
            id: string;
            name: string;
            description: string | null;
            claimedByUserId: string | null;
            languages: string[];
            accessChannels: unknown[];
            logoUrl: string | null;
            city: { name: string };
          }) => {
            const isActive = activeCommunity?.id === c.id;
            const completeness = [
              !!c.name,
              !!c.description,
              c.languages.length > 0,
              c.accessChannels.length > 0,
              !!c.logoUrl,
            ];
            const pct = Math.round(
              (completeness.filter(Boolean).length / completeness.length) * 100,
            );
            const isOwner = c.claimedByUserId === user.id;

            return (
              <div
                key={c.id}
                className={`card-base p-5 ${isActive ? 'ring-brand-500 ring-2 ring-offset-2' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="bg-brand-100 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{c.name}</h2>
                    <p className="text-muted text-sm">{c.city.name}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="bg-muted-bg text-muted rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      {isOwner ? 'Community admin' : 'Collaborator'}
                    </span>
                    {isActive && (
                      <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile completeness */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted text-xs">Profile</span>
                    <span className="text-muted text-xs font-medium">{pct}%</span>
                  </div>
                  <div className="bg-muted-bg h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-brand-500 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {!isActive ? (
                    <form
                      action="/organizer/switch?next=/organizer"
                      method="POST"
                      className="flex-1"
                    >
                      <input type="hidden" name="communityId" value={c.id} />
                      <button
                        type="submit"
                        className="border-brand-200 text-brand-700 hover:bg-brand-50 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      >
                        Switch & open
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/organizer"
                      className="border-brand-200 text-brand-700 hover:bg-brand-50 flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors"
                    >
                      Open workspace →
                    </Link>
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
