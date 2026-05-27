import Link from 'next/link';
import { content, communityOptions } from '@indlokal/shared';
import { requireSessionUser, getCurrentCommunityId } from '@/lib/session';
import { ContentCallout } from '@/components/content/community-actions';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import { CollaboratorInviteCard } from './CollaboratorInviteCard';

export default async function OrganizerDashboardPage() {
  const user = await requireSessionUser();
  const currentId = await getCurrentCommunityId();
  const community =
    user.claimedCommunities.find((c: { id: string }) => c.id === currentId) ??
    user.claimedCommunities[0];

  if (!community) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">No approved community found for your account.</p>
        <Link href="/organizer/login" className="mt-2 block text-sm underline">
          Back to login
        </Link>
      </div>
    );
  }

  const completeness = [
    { label: 'Name', done: !!community.name },
    { label: 'Description', done: !!community.description },
    { label: 'Long description', done: !!community.descriptionLong },
    { label: 'Languages', done: community.languages.length > 0 },
    { label: 'Founded year', done: !!community.foundedYear },
    { label: 'Member count', done: !!community.memberCountApprox },
    { label: 'Access channel', done: community.accessChannels.length > 0 },
    { label: 'Logo', done: !!community.logoUrl },
  ];
  const doneCount = completeness.filter((c) => c.done).length;
  const pct = Math.round((doneCount / completeness.length) * 100);

  return (
    <div className="space-y-8">
      <OrganizerPageHeader title={community.name} description={community.city.name} />

      <ContentCallout
        title="What can I do here?"
        body={content.COMMUNITY_ACTION_COPY.organizerDashboardBody}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quick actions */}
        <Link
          href="/organizer/edit"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">✏️</div>
          <h2 className="text-foreground mt-3 font-semibold">Edit profile</h2>
          <p className="text-muted mt-1 text-sm">
            Update the name, description, languages, and details people see first.
          </p>
        </Link>
        <Link
          href="/organizer/channels"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">🔗</div>
          <h2 className="text-foreground mt-3 font-semibold">Community links</h2>
          <p className="text-muted mt-1 text-sm">
            Add or remove WhatsApp, Telegram, website, and other access links.
          </p>
        </Link>
        <Link
          href="/organizer/events/new"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">📅</div>
          <h2 className="text-foreground mt-3 font-semibold">Add event</h2>
          <p className="text-muted mt-1 text-sm">
            Post an upcoming event so it appears on the community page and city feed.
          </p>
        </Link>
      </div>

      {/* Profile completeness */}
      <div className="card-base p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground font-semibold">Profile completeness</h2>
          <span className="text-brand-600 text-sm font-medium">{pct}%</span>
        </div>
        <div className="bg-muted-bg mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-brand-500 h-full rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {completeness.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.done ? 'text-success' : 'text-border'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-foreground' : 'text-muted'}>{item.label}</span>
            </div>
          ))}
        </div>
        {pct < 100 && (
          <Link
            href="/organizer/edit"
            className="text-brand-600 hover:text-brand-700 mt-4 inline-block text-sm font-medium hover:underline"
          >
            Complete profile →
          </Link>
        )}
      </div>

      {/* Current channels */}
      {community.accessChannels.length > 0 && (
        <div className="card-base p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold">Access channels</h2>
            <Link
              href="/organizer/channels"
              className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
            >
              Edit links
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {community.accessChannels.map(
              (ch: {
                id: string;
                url: string;
                channelType: string;
                label: string | null;
                isPrimary: boolean;
              }) => (
                <a
                  key={ch.id}
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border text-foreground hover:bg-muted-bg inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-1.5 text-sm transition-colors"
                >
                  {communityOptions.CHANNEL_TYPE_ICONS[
                    ch.channelType as communityOptions.CommunityChannelType
                  ] ?? '🔗'}{' '}
                  {ch.label ?? ch.channelType}
                  {ch.isPrimary && (
                    <span className="bg-brand-100 text-brand-600 rounded-full px-1.5 text-xs">
                      Primary
                    </span>
                  )}
                </a>
              ),
            )}
          </div>
        </div>
      )}

      <CollaboratorInviteCard />

      {/* View public page */}
      <p className="text-muted text-sm">
        Public page:{' '}
        <Link
          href={`/${community.city.slug}/communities/${community.slug}`}
          className="text-brand-600 hover:text-brand-700 hover:underline"
        >
          /{community.city.slug}/communities/{community.slug}
        </Link>
      </p>
    </div>
  );
}
