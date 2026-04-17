import Link from 'next/link';
import { requireSessionUser } from '@/lib/session';

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: '💬',
  TELEGRAM: '✈️',
  WEBSITE: '🌐',
  FACEBOOK: '📘',
  INSTAGRAM: '📸',
  EMAIL: '✉️',
  MEETUP: '🤝',
  YOUTUBE: '▶️',
  LINKEDIN: '💼',
  OTHER: '🔗',
};

export default async function OrganizerDashboardPage() {
  const user = await requireSessionUser();
  const community = user.claimedCommunities[0];

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
      {/* Header */}
      <div>
        <p className="text-muted text-sm">Managing</p>
        <h1 className="text-foreground mt-0.5 text-2xl font-bold">{community.name}</h1>
        <p className="text-muted mt-1 text-sm">{community.city.name}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quick actions */}
        <Link
          href="/organizer/edit"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">✏️</div>
          <h2 className="text-foreground mt-3 font-semibold">Edit Profile</h2>
          <p className="text-muted mt-1 text-sm">
            Update name, description, languages, founded year
          </p>
        </Link>
        <Link
          href="/organizer/channels"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">🔗</div>
          <h2 className="text-foreground mt-3 font-semibold">Manage Channels</h2>
          <p className="text-muted mt-1 text-sm">Add or remove WhatsApp, Telegram, website links</p>
        </Link>
        <Link
          href="/organizer/events/new"
          className="card-base group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-2xl">📅</div>
          <h2 className="text-foreground mt-3 font-semibold">Add Event</h2>
          <p className="text-muted mt-1 text-sm">Post an upcoming event to your community page</p>
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
              Manage
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {community.accessChannels.map((ch) => (
              <a
                key={ch.id}
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border text-foreground hover:bg-muted-bg inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-1.5 text-sm transition-colors"
              >
                {CHANNEL_ICONS[ch.channelType] ?? '🔗'} {ch.label ?? ch.channelType}
                {ch.isPrimary && (
                  <span className="bg-brand-100 text-brand-600 rounded-full px-1.5 text-xs">
                    Primary
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

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
