import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { PortalShell } from '@/components/organizer/portal-shell';
import { getHostProfile } from '@/lib/organizer/host-workspace';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // Only EVENT_HOST and PLATFORM_ADMIN may access the host sub-portal
  if (!user) redirect('/organizer/host/start');
  if (user.role !== 'EVENT_HOST' && user.role !== 'PLATFORM_ADMIN') {
    // Community admins go to the main organizer portal
    redirect('/organizer');
  }

  const profile = getHostProfile(user);
  const hostName = profile.displayName || user.displayName || user.email;

  const [latestPublishedEvent, profileCity] = await Promise.all([
    db.event.findFirst({
      where: { createdByUserId: user.id, moderationState: 'PUBLISHED' },
      select: { slug: true, city: { select: { slug: true } } },
      orderBy: { startsAt: 'desc' },
    }),
    profile.cityId
      ? db.city.findUnique({ where: { id: profile.cityId }, select: { slug: true } })
      : Promise.resolve(null),
  ]);

  const publicViewHref = latestPublishedEvent
    ? `/${latestPublishedEvent.city.slug}/events/${latestPublishedEvent.slug}`
    : profileCity
      ? `/${profileCity.slug}/events`
      : '/';

  const navLinks = [
    { href: '/organizer/host', label: 'Dashboard' },
    { href: '/organizer/host/events', label: 'My Events' },
    { href: '/organizer/host/profile', label: 'Host Profile' },
  ];

  const titleSlot = (
    <Link
      href="/organizer/host/profile"
      className="border-border hover:bg-muted-bg flex h-10 min-w-0 max-w-[220px] items-center gap-2 rounded-[var(--radius-button)] border bg-white px-2.5 text-left transition-colors sm:max-w-[340px]"
      aria-label="Event Host Profile"
    >
      <span className="bg-brand-100 text-brand-700 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        {hostName.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[13px] font-semibold leading-4">
          {hostName}
        </span>
        <span className="text-muted block truncate text-[11px] leading-3">Event host</span>
      </span>
    </Link>
  );

  return (
    <PortalShell
      brandHref="/organizer/host"
      titleSlot={titleSlot}
      navLinks={navLinks}
      cta={{ href: '/organizer/host/events/new', label: '+ New Event' }}
      publicViewHref={publicViewHref}
      account={{ label: user.displayName ?? user.email, email: user.email }}
    >
      {children}
    </PortalShell>
  );
}
