import Link from 'next/link';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { PortalShell } from '@/components/organizer/portal-shell';
import { buildOrganizerWorkspace, type OrganizerSessionCommunity } from '@/lib/organizer/workspace';
import { ACTIVE_BUSINESS_CONNECT_PROGRAM } from '@/app/jito-stuttgart/business-connect/pilot';

export default async function CommunityOrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const currentCommunityId = user ? await getCurrentCommunityId() : null;
  const workspace = user
    ? buildOrganizerWorkspace<OrganizerSessionCommunity>(user, currentCommunityId)
    : null;
  const activeCommunity = workspace?.community ?? null;
  const activeRole = workspace?.role ?? null;
  const isMultiOrg = workspace?.isMultiCommunity ?? false;
  const publicViewHref = activeCommunity
    ? `/${activeCommunity.city.slug}/communities/${activeCommunity.slug}`
    : '/';

  const navLinks = [
    { href: '/organizer', label: 'Overview' },
    { href: '/organizer/profile', label: 'Community Profile' },
    { href: '/organizer/links', label: 'Links' },
    { href: '/organizer/collaborators', label: 'Team' },
    { href: '/organizer/events', label: 'Events' },
  ];

  // Business Connect is invite-only and scoped to its pilot's community, so only
  // that community's organizer workspace surfaces the invite tools.
  if (activeCommunity?.slug === ACTIVE_BUSINESS_CONNECT_PROGRAM.communitySlug) {
    navLinks.push({ href: '/organizer/business-connect', label: 'Business Connect' });
  }

  const titleSlot = activeCommunity ? (
    <Link
      href={isMultiOrg ? '/organizer/communities' : '/organizer'}
      className="border-border hover:bg-muted-bg flex h-10 max-w-[220px] min-w-0 items-center gap-2 rounded-[var(--radius-button)] border bg-white px-2.5 text-left transition-colors sm:max-w-[340px]"
      aria-label={isMultiOrg ? 'Switch community workspace' : 'Current community workspace'}
    >
      <span className="bg-brand-100 text-brand-700 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        {activeCommunity.name.charAt(0)}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[13px] leading-4 font-semibold">
          {activeCommunity.name}
        </span>
        <span className="text-muted block truncate text-[11px] leading-3">
          {activeCommunity.city.name}
          {activeRole
            ? ` · ${activeRole === 'COMMUNITY_ADMIN' ? 'Community admin' : 'Collaborator'}`
            : ''}
        </span>
      </span>
      {isMultiOrg && <span className="text-muted ml-auto shrink-0 text-xs">⌄</span>}
    </Link>
  ) : (
    <Link
      href="/organizer"
      className="text-foreground hover:text-brand-600 text-sm font-semibold transition-colors"
    >
      Organizer Home
    </Link>
  );

  return (
    <PortalShell
      brandHref="/organizer"
      titleSlot={titleSlot}
      navLinks={navLinks}
      cta={{ href: '/organizer/events/new', label: '+ New Event' }}
      publicViewHref={publicViewHref}
      account={user ? { label: user.displayName ?? user.email, email: user.email } : undefined}
    >
      {children}
    </PortalShell>
  );
}
