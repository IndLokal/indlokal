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
        <p className="text-sm text-gray-500">Managing</p>
        <h1 className="mt-0.5 text-2xl font-bold">{community.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{community.city.name}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quick actions */}
        <Link
          href="/organizer/edit"
          className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="text-2xl">✏️</div>
          <h2 className="mt-3 font-semibold">Edit Profile</h2>
          <p className="mt-1 text-sm text-gray-500">
            Update name, description, languages, founded year
          </p>
        </Link>
        <Link
          href="/organizer/channels"
          className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="text-2xl">🔗</div>
          <h2 className="mt-3 font-semibold">Manage Channels</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add or remove WhatsApp, Telegram, website links
          </p>
        </Link>
        <Link
          href="/organizer/events/new"
          className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="text-2xl">📅</div>
          <h2 className="mt-3 font-semibold">Add Event</h2>
          <p className="mt-1 text-sm text-gray-500">
            Post an upcoming event to your community page
          </p>
        </Link>
      </div>

      {/* Profile completeness */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Profile completeness</h2>
          <span className="text-sm font-medium text-indigo-600">{pct}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {completeness.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.done ? 'text-green-500' : 'text-gray-300'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
            </div>
          ))}
        </div>
        {pct < 100 && (
          <Link
            href="/organizer/edit"
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Complete profile →
          </Link>
        )}
      </div>

      {/* Current channels */}
      {community.accessChannels.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Access channels</h2>
            <Link href="/organizer/channels" className="text-sm text-indigo-600 hover:underline">
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
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {CHANNEL_ICONS[ch.channelType] ?? '🔗'} {ch.label ?? ch.channelType}
                {ch.isPrimary && (
                  <span className="rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-600">
                    Primary
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* View public page */}
      <p className="text-sm text-gray-400">
        Public page:{' '}
        <Link
          href={`/${community.city.slug}/communities/${community.slug}`}
          className="text-indigo-600 hover:underline"
        >
          /{community.city.slug}/communities/{community.slug}
        </Link>
      </p>
    </div>
  );
}
